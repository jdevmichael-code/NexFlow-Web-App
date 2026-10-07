import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { getDoc } from '../db.js'

export const COOKIE_NAME = 'nexflow_session'

const HOUR = 60 * 60 * 1000
const SHORT_SESSION = 8 * HOUR
const LONG_SESSION = 7 * 24 * HOUR // "Remember me"

/**
 * Log the user in by giving the browser a signed session cookie.
 * httpOnly: page JavaScript can't read it (protects against XSS token theft).
 * sameSite strict: other websites can't make requests with it (protects against CSRF).
 */
export function setSessionCookie(res, user, remember = false) {
  const maxAge = remember ? LONG_SESSION : SHORT_SESSION
  const token = jwt.sign({ ver: user.tokenVersion }, config.jwtSecret, {
    subject: user._id,
    expiresIn: Math.floor(maxAge / 1000),
  })

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.useHttps, // "Secure" cookies are only sent over https
    maxAge,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: config.useHttps, path: '/' })
}

/**
 * Turn a session token into the current user doc, or null if it isn't valid.
 * The user is loaded fresh every time, so disabling a user or bumping
 * tokenVersion (password change, admin reset) takes effect immediately.
 */
export async function userFromToken(token) {
  if (!token) return null

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    return null
  }

  const user = await getDoc(payload.sub)
  if (!user || user.type !== 'user') return null
  if (user.status !== 'active') return null
  if (user.tokenVersion !== payload.ver) return null
  return user
}

/** Only logged-in users get past this. Sets req.user. */
export async function requireAuth(req, res, next) {
  const user = await userFromToken(req.cookies?.[COOKIE_NAME])
  if (!user) return res.status(401).json({ error: 'Please log in' })
  req.user = user
  next()
}

/** Use after requireAuth. */
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
  next()
}
