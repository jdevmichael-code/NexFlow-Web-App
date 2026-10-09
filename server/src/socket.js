import { Server } from 'socket.io'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { getDoc } from './db.js'
import { COOKIE_NAME, userFromToken } from './middleware/auth.js'
import { canView } from './utils/access.js'

// The client only uses the socket to listen. All saving happens through REST routes,
// which then call io.to(...).emit(...).
//
// Socket rooms:
//   'room:<id>'      everyone looking at a chat room
//   'channel:<id>'   everyone looking at a channel
//   '<user id>'      all open tabs of one user (for personal events)
//
// Presence: a user is "online" while they have at least one open socket.
// Everyone gets 'presence:changed' { userId, online } when that flips.

export let io

// userId → number of open sockets (tabs). Kept in memory, so this assumes one server process.
const openSockets = new Map()

export const isOnline = (userId) => openSockets.has(userId)
export const onlineUserIds = () => [...openSockets.keys()]

export function setupSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
    maxHttpBufferSize: 100_000, // the client never sends big data over the socket
  })

  // Read the same session cookie the REST API uses
  io.engine.use(cookieParser())

  io.use(async (socket, next) => {
    const user = await userFromToken(socket.request.cookies?.[COOKIE_NAME])
    if (!user) return next(new Error('Please log in'))
    socket.data.userId = user._id
    next()
  })

  io.on('connection', (socket) => {
    const { userId } = socket.data
    socket.join(userId)

    const count = (openSockets.get(userId) || 0) + 1
    openSockets.set(userId, count)
    if (count === 1) io.emit('presence:changed', { userId, online: true })

    socket.on('disconnect', () => {
      const left = (openSockets.get(userId) || 1) - 1
      if (left > 0) return openSockets.set(userId, left)
      openSockets.delete(userId)
      io.emit('presence:changed', { userId, online: false })
    })

    for (const type of ['room', 'channel']) {
      socket.on(`${type}:join`, async (placeId, reply) => {
        const ok = await canWatch(socket.data.userId, type, placeId)
        if (ok) socket.join(`${type}:${placeId}`)
        if (typeof reply === 'function') reply({ ok })
      })

      socket.on(`${type}:leave`, (placeId) => {
        socket.leave(`${type}:${placeId}`)
      })
    }
  })
}

/** Can this user receive live updates for this room/channel? */
async function canWatch(userId, type, placeId) {
  if (typeof placeId !== 'string') return false
  try {
    // Load fresh data: the user's role or the members list may have changed
    const [user, place] = await Promise.all([getDoc(userId), getDoc(placeId)])
    if (!user || user.status !== 'active') return false
    if (!place || place.type !== type) return false
    return canView(user, place)
  } catch {
    return false
  }
}

/** Disconnect every open socket of a user (after logout-everywhere, disable, delete). */
export function kickUser(userId) {
  io.in(userId).disconnectSockets(true)
}
