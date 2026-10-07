import { Router } from 'express'
import { z } from 'zod'
import { getDoc, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { imageUpload, removeImage } from '../middleware/upload.js'
import { httpError, validate } from '../utils/http.js'
import { displayNameSchema, publicUser, searchUsers, shortUser } from '../utils/users.js'

const router = Router()
router.use(requireAuth)

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
  res.json(publicUser(user))
})

export default router
