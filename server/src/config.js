import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Load server/.env no matter which folder the app is started from
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in server/.env`)
  return value
}

export const config = {
  port: Number(process.env.PORT || 4000),
  // Set USE_HTTPS=true only when the app is opened through https://
  // (it marks the session cookie "Secure" and turns on HSTS).
  useHttps: process.env.USE_HTTPS === 'true',

  couchHost: required('COUCH_HOST'),
  couchUser: required('COUCH_USER'),
  couchPassword: required('COUCH_PASSWORD'),
  dbName: process.env.DB_NAME || 'nexflow_db',

  jwtSecret: required('JWT_SECRET'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  uploadDir: required('UPLOAD_DIR'),
  largeImageBytes: Number(process.env.LARGE_IMAGE_BYTES || 1024 * 1024),
  maxUploadBytes: 10 * 1024 * 1024,
}
