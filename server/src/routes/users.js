import { Router } from 'express'
import { z } from 'zod'
import { getDoc, getDocs, queryView, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { imageUpload, removeImage } from '../middleware/upload.js'
import { isOnline, onlineUserIds } from '../socket.js'
import { httpError, validate } from '../utils/http.js'
import { displayNameSchema, publicUser, searchUsers, shortUser } from '../utils/users.js'

const router = Router()
router.use(requireAuth)

const OFFLINE_PAGE_SIZE = 30

const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: z.string().trim().max(300).optional().default(''),
})

// Search users whose username or name starts with the text (used to add members)
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 30)
  const { users } = await searchUsers(q, 20)
  res.json(
    users
      .filter((user) => user.status === 'active')
      .slice(0, 10)
      .map(shortUser),
  )
})

// GET /api/users/presence?skip=0
// Everyone who is online now, plus one page of the other users (newest accounts first).
// `nextSkip` is the skip for the next page, or null when there are no more users.
router.get('/presence', async (req, res) => {
  const skip = Math.max(0, Math.floor(Number(req.query.skip)) || 0)
  const isListed = (user) => user && user.status === 'active' && user._id !== req.user._id

  const [onlineDocs, page] = await Promise.all([
    getDocs(onlineUserIds()),
    queryView('users_by_created', { descending: true, skip, limit: OFFLINE_PAGE_SIZE, include_docs: true }),
  ])

  const seen = skip + page.rows.length
  res.json({
    online: onlineDocs
      .filter(isListed)
      .map(shortUser)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    offline: page.rows
      .map((row) => row.doc)
      .filter((user) => isListed(user) && !isOnline(user._id))
      .map((user) => ({ ...shortUser(user), lastLoginAt: user.lastLoginAt })),
    nextSkip: seen < page.total_rows ? seen : null,
  })
})

router.put('/me', async (req, res) => {
  const { displayName, bio } = validate(profileSchema, req.body)
  const saved = await updateDoc(req.user._id, (doc) => {
    doc.displayName = displayName
    doc.bio = bio
  })
  res.json(publicUser(saved))
})

router.post('/me/avatar', imageUpload('avatars'), async (req, res) => {
  if (!req.file) throw httpError(400, 'Please choose an image')

  const oldAvatar = req.user.avatar
  const saved = await updateDoc(req.user._id, (doc) => {
    doc.avatar = `avatars/${req.file.filename}`
  })
  await removeImage({ path: oldAvatar })

  res.json(publicUser(saved))
})

router.get('/:id', async (req, res) => {
  const user = await getDoc(req.params.id)
  if (!user || user.type !== 'user') throw httpError(404, 'User not found')
  res.json({ ...publicUser(user), online: isOnline(user._id) })
})

export default router
