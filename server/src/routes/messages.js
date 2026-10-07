// Chat messages, mounted at /api/rooms/:roomId/messages

import { Router } from 'express'
import { z } from 'zod'
import { findDocs, getDoc, newId, now, saveDoc, sortBy, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { imageInfo, imageUpload } from '../middleware/upload.js'
import { io } from '../socket.js'
import { canView, isMember } from '../utils/access.js'
import { logActivity } from '../utils/activity.js'
import { httpError, validate } from '../utils/http.js'
import { getPlace } from '../utils/places.js'
import { reactionSchema, toggleReaction } from '../utils/reactions.js'
import { attachUser, attachUsers } from '../utils/users.js'

const router = Router({ mergeParams: true })
router.use(requireAuth)

const PAGE_SIZE = 50

const messageSchema = z.object({
  text: z.string().trim().max(2000, 'Message is too long (max 2000 characters)').optional().default(''),
})

const historySchema = z.object({
  before: z.iso.datetime({ message: 'before must be a date' }).optional(),
})

// GET /api/rooms/:roomId/messages?before=<createdAt of the oldest message you have>
// Returns 50 messages (oldest first) and whether there are even older ones.
router.get('/', async (req, res) => {
  const room = await getPlace('room', req.params.roomId)
  if (!canView(req.user, room)) throw httpError(403, 'Join this room to see its messages')

  const { before } = validate(historySchema, req.query)
  const selector = { type: 'message', roomId: room._id }
  if (before) selector.createdAt = { $lt: before }

  // Ask for one extra: if it comes back, there is more history to load
  const newestFirst = await findDocs(selector, {
    sort: sortBy(['type', 'roomId', 'createdAt'], 'desc'),
    limit: PAGE_SIZE + 1,
  })
  const hasMore = newestFirst.length > PAGE_SIZE
  const page = newestFirst.slice(0, PAGE_SIZE).reverse()

  res.json({ messages: await attachUsers(page, 'authorId', 'author'), hasMore })
})

router.post('/', imageUpload('messages'), async (req, res) => {
  const room = await getPlace('room', req.params.roomId)
  if (!isMember(req.user, room)) throw httpError(403, 'Join this room to send messages')

  const { text } = validate(messageSchema, req.body)
  const image = imageInfo(req.file, 'messages')
  if (!text && !image) throw httpError(400, 'Write a message or choose an image')

  const message = await saveDoc({
    _id: newId(),
    type: 'message',
    roomId: room._id,
    authorId: req.user._id,
    text,
    image,
    reactions: {},
    createdAt: now(),
  })

  const withAuthor = await attachUser(message, 'authorId', 'author')
  io.to(`room:${room._id}`).emit('message:new', withAuthor)
  await logActivity(req.user._id, 'sent_message', `Sent a message in "${room.name}"`, `/rooms/${room._id}`)

  res.status(201).json(withAuthor)
})

router.post('/:messageId/react', async (req, res) => {
  const room = await getPlace('room', req.params.roomId)
  if (!isMember(req.user, room)) throw httpError(403, 'Join this room to react')

  const { emoji } = validate(reactionSchema, req.body)
  const message = await getDoc(req.params.messageId)
  if (!message || message.type !== 'message' || message.roomId !== room._id) throw httpError(404, 'Message not found')

  let added = false
  const saved = await updateDoc(message._id, (doc) => {
    added = toggleReaction(doc, emoji, req.user._id)
  })

  io.to(`room:${room._id}`).emit('message:updated', { _id: saved._id, reactions: saved.reactions })
  if (added) await logActivity(req.user._id, 'reacted', `Reacted ${emoji} in "${room.name}"`, `/rooms/${room._id}`)

  res.json({ _id: saved._id, reactions: saved.reactions })
})

export default router
