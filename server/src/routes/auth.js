import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { getDoc, now, saveDoc, updateDoc } from '../db.js'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js'
import { kickUser } from '../socket.js'
import { httpError, validate } from '../utils/http.js'
import { checkPassword, hashPassword, passwordSchema } from '../utils/passwords.js'
import { displayNameSchema, newUser, publicUser, userIdFor, usernameSchema } from '../utils/users.js'

const router = Router()

const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15

// Max 10 failed login/register attempts per IP every 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
})

const registerSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
})

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Username is required').max(20),
  password: z.string().min(1, 'Password is required').max(200),
  remember: z.boolean().optional().default(false),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
})

router.post('/register', authLimiter, async (req, res) => {
  const { username, displayName, password } = validate(registerSchema, req.body)

  const user = newUser({ username, displayName, passwordHash: await hashPassword(password) })
  user.lastLoginAt = now()

  let saved
  try {
    saved = await saveDoc(user)
  } catch (err) {
    if (err.statusCode === 409) throw httpError(409, 'That username is already taken')
    throw err
  }

  setSessionCookie(res, saved)
  res.status(201).json(publicUser(saved))
})

router.post('/login', authLimiter, async (req, res) => {
  const { username, password, remember } = validate(loginSchema, req.body)

  const found = await getDoc(userIdFor(username))
  const user = found?.type === 'user' && found.status !== 'deleted' ? found : null

  if (user?.lockedUntil && user.lockedUntil > now()) {
    throw httpError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`)
  }

  const passwordOk = await checkPassword(password, user?.passwordHash)
  if (!user || !passwordOk) {
    if (user) await recordFailedLogin(user._id)
    throw httpError(401, 'Invalid username or password')
  }

  if (user.status === 'disabled') {
    throw httpError(403, 'This account has been disabled. Please contact an admin.')
  }

  const saved = await updateDoc(user._id, (doc) => {
    doc.failedLogins = 0
    doc.lockedUntil = null
    doc.lastLoginAt = now()
  })

  setSessionCookie(res, saved, remember)
  res.json(publicUser(saved))
})

async function recordFailedLogin(userId) {
  await updateDoc(userId, (doc) => {
    doc.failedLogins = (doc.failedLogins || 0) + 1
    if (doc.failedLogins >= MAX_FAILED_LOGINS) {
      doc.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      doc.failedLogins = 0
    }
  })
}

router.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user))
})

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = validate(changePasswordSchema, req.body)

  if (!(await checkPassword(currentPassword, req.user.passwordHash))) {
    throw httpError(400, 'Current password is wrong')
  }

  const passwordHash = await hashPassword(newPassword)
  const saved = await updateDoc(req.user._id, (doc) => {
    doc.passwordHash = passwordHash
    doc.tokenVersion += 1 // logs out every other session
  })

  kickUser(saved._id)
  setSessionCookie(res, saved) // keep this browser logged in
  res.json({ ok: true })
})

export default router
