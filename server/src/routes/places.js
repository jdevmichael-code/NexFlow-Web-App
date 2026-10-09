// Routes shared by chat rooms and channels:
//   app.use('/api/rooms', placeRouter('room'))
//   app.use('/api/channels', placeRouter('channel'))

import { Router } from 'express'
import { z } from 'zod'
import { deleteDocs, findAllDocs, getDoc, newId, now, saveDoc, sortBy, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../socket.js'
import { canJoin, canManage, canView, isAdmin, isMember, isOwner } from '../utils/access.js'
import { logActivity } from '../utils/activity.js'
import { httpError, validate } from '../utils/http.js'
import {
  deletePlaceContent,
  directRoomName,
  findDirectRoom,
  getPlace,
  placeDetails,
  placeLabel,
  placesOfMember,
  placeSummary,
} from '../utils/places.js'
import { attachUsers, shortUser } from '../utils/users.js'

const placeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  description: z.string().trim().max(300).optional().default(''),
  isPublic: z.boolean(),
})

const addMemberSchema = z.object({
  userId: z.string().min(1).max(100),
})

export function placeRouter(type) {
  const router = Router()
  router.use(requireAuth)

  const label = placeLabel(type)
  const socketRoom = (id) => `${type}:${id}`
  const pageLink = (id) => `/${type}s/${id}`

  // Tell everyone looking at this place to reload its details
  const announceChange = (id) => io.to(socketRoom(id)).emit(`${type}:changed`, { id })

  // List: admins see everything; others see public places plus the (private) ones they belong to
  router.get('/', async (req, res) => {
    let places
    if (isAdmin(req.user)) {
      places = await findAllDocs({ type }, { sort: sortBy(['type', 'createdAt'], 'desc') })
    } else {
      const [publicPlaces, myPlaces] = await Promise.all([
        findAllDocs({ type, isPublic: true }, { sort: sortBy(['type', 'isPublic', 'createdAt'], 'desc') }),
        placesOfMember(req.user._id, type), // view lookup, no scan of every room
      ])
      const byId = new Map([...publicPlaces, ...myPlaces].map((place) => [place._id, place]))
      places = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    const withOwners = await attachUsers(places, 'ownerId', 'owner')
    res.json(withOwners.map((place) => placeSummary(place, req.user)))
  })

  router.post('/', async (req, res) => {
    const data = validate(placeSchema, req.body)
    const place = await saveDoc({
      _id: newId(),
      type,
      ...data,
      ownerId: req.user._id,
      members: [req.user._id],
      createdAt: now(),
    })

    await logActivity(req.user._id, `created_${type}`, `Created ${type} "${place.name}"`, pageLink(place._id))
    res.status(201).json(await placeDetails(place, req.user))
  })

  // "Send message": the private room with just you and one other user (rooms only).
  // There is one per pair of users: if it already exists, you get that one instead of a new room.
  if (type === 'room') {
    router.post('/direct', async (req, res) => {
      const { userId } = validate(addMemberSchema, req.body)
      if (userId === req.user._id) throw httpError(400, 'You cannot send a private message to yourself')

      const other = await getDoc(userId)
      if (!other || other.type !== 'user' || other.status !== 'active') throw httpError(404, 'User not found')

      const existing = await findDirectRoom(req.user._id, other._id)
      if (existing) return res.json({ ...(await placeDetails(existing, req.user)), existing: true })

      const place = await saveDoc({
        _id: newId(),
        type,
        name: directRoomName(req.user, other),
        description: `Private chat between ${req.user.displayName} and ${other.displayName}`,
        isPublic: false,
        isDirect: true,
        ownerId: req.user._id,
        members: [req.user._id, other._id],
        createdAt: now(),
      })

      await logActivity(req.user._id, 'created_room', `Started a private chat with ${other.displayName}`, pageLink(place._id))
      // Let the other user know, in any tab they have open
      io.to(other._id).emit('room:direct', { id: place._id, name: place.name, from: shortUser(req.user) })
      res.status(201).json(await placeDetails(place, req.user))
    })
  }

  router.get('/:id', async (req, res) => {
    const place = await getPlace(type, req.params.id)

    // Private places are invisible to outsiders
    if (!canView(req.user, place) && !place.isPublic) throw httpError(404, `${label} not found`)

    res.json(await placeDetails(place, req.user))
  })

  router.put('/:id', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (!canManage(req.user, place)) throw httpError(403, `Only the owner can edit this ${type}`)

    const data = validate(placeSchema, req.body)
    const saved = await updateDoc(place._id, (doc) => Object.assign(doc, data))

    announceChange(place._id)
    res.json(await placeDetails(saved, req.user))
  })

  router.post('/:id/join', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (isMember(req.user, place)) return res.json(await placeDetails(place, req.user))
    if (!canJoin(req.user, place)) throw httpError(403, `This ${type} is private`)

    const saved = await updateDoc(place._id, (doc) => {
      if (!doc.members.includes(req.user._id)) doc.members.push(req.user._id)
    })

    await logActivity(req.user._id, `joined_${type}`, `Joined ${type} "${place.name}"`, pageLink(place._id))
    announceChange(place._id)
    res.json(await placeDetails(saved, req.user))
  })

  router.post('/:id/leave', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (isOwner(req.user, place)) throw httpError(400, `You own this ${type}. Delete it instead of leaving.`)

    await updateDoc(place._id, (doc) => {
      doc.members = doc.members.filter((id) => id !== req.user._id)
    })

    io.in(req.user._id).socketsLeave(socketRoom(place._id))
    announceChange(place._id)
    res.json({ ok: true })
  })

  router.post('/:id/members', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (!canManage(req.user, place)) throw httpError(403, 'Only the owner can add members')

    const { userId } = validate(addMemberSchema, req.body)
    const user = await getDoc(userId)
    if (!user || user.type !== 'user' || user.status !== 'active') throw httpError(404, 'User not found')

    const saved = await updateDoc(place._id, (doc) => {
      if (!doc.members.includes(userId)) doc.members.push(userId)
    })

    announceChange(place._id)
    res.json(await placeDetails(saved, req.user))
  })

  router.delete('/:id/members/:userId', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (!canManage(req.user, place)) throw httpError(403, 'Only the owner can remove members')

    const { userId } = req.params
    if (userId === place.ownerId) throw httpError(400, 'The owner cannot be removed')

    const saved = await updateDoc(place._id, (doc) => {
      doc.members = doc.members.filter((id) => id !== userId)
    })

    // Stop their live updates and tell their open tabs
    io.in(userId).socketsLeave(socketRoom(place._id))
    io.to(userId).emit(`${type}:removed`, { id: place._id })
    announceChange(place._id)
    res.json(await placeDetails(saved, req.user))
  })

  // Delete all messages/posts but keep the room/channel
  router.post('/:id/clear', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (!canManage(req.user, place)) throw httpError(403, `Only the owner or an admin can clear this ${type}`)

    await deletePlaceContent(type, place._id)
    io.to(socketRoom(place._id)).emit(`${type}:cleared`, { id: place._id })
    res.json({ ok: true })
  })

  // Delete the room/channel and everything in it
  router.delete('/:id', async (req, res) => {
    const place = await getPlace(type, req.params.id)
    if (!canManage(req.user, place)) throw httpError(403, `Only the owner or an admin can delete this ${type}`)

    await deletePlaceContent(type, place._id)
    await deleteDocs([place])

    io.to(socketRoom(place._id)).emit(`${type}:deleted`, { id: place._id })
    io.in(socketRoom(place._id)).socketsLeave(socketRoom(place._id))
    res.json({ ok: true })
  })

  return router
}
