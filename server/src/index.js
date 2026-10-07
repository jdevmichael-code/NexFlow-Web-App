import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { config } from './config.js'
import { connectDb } from './db.js'
import { setupSocket } from './socket.js'
import { requireAuth } from './middleware/auth.js'
import { ensureUploadFolders } from './middleware/upload.js'
import { placeRouter } from './routes/places.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import messageRoutes from './routes/messages.js'
import postRoutes from './routes/posts.js'
import planRoutes from './routes/plans.js'
import itemRoutes from './routes/items.js'
import dashboardRoutes from './routes/dashboard.js'
import adminRoutes from './routes/admin.js'

const app = express()
const server = http.createServer(app)
setupSocket(server)

// ---- Security & parsing ----
app.disable('x-powered-by')
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        // Over plain http this would make the browser load our scripts via https and break the page
        'upgrade-insecure-requests': config.useHttps ? [] : null,
      },
    },
    strictTransportSecurity: config.useHttps,
  }),
)
app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// ---- API ----
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/rooms/:roomId/messages', messageRoutes)
app.use('/api/rooms', placeRouter('room'))
app.use('/api/channels/:channelId/posts', postRoutes)
app.use('/api/channels', placeRouter('channel'))
app.use('/api/plans', planRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// ---- Uploaded images (logged-in users only) ----
app.use('/files', requireAuth, express.static(config.uploadDir, { index: false, fallthrough: false }))

// ---- Built client (production). In development Vite serves the client. ----
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url))
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('/{*page}', (req, res) => res.sendFile('index.html', { root: clientDist }))
}

// ---- Errors ----
app.use((err, req, res, next) => {
  // If the request uploaded a file but then failed, don't keep the file
  if (req.file) fs.rm(req.file.path, { force: true }, () => {})

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too big (max 10 MB)' : 'Upload failed: ' + err.message
    return res.status(400).json({ error: message })
  }

  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error(err)

  // Never leak internal error details to the browser
  res.status(status).json({ error: status >= 500 ? 'Something went wrong, please try again' : err.message })
})

// ---- Start ----
async function start() {
  await connectDb()
  await ensureUploadFolders()
  server.listen(config.port, () => {
    console.log(`NexFlow server running on http://localhost:${config.port}`)
  })
}

start().catch((err) => {
  console.error('Could not start the server:', err.message)
  process.exit(1)
})
