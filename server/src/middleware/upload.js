import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { httpError } from '../utils/http.js'

export const UPLOAD_FOLDERS = ['avatars', 'messages', 'posts', 'items']

const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
}

/** Make sure the upload folders exist and that we are allowed to write to them. */
export async function ensureUploadFolders() {
  try {
    for (const folder of UPLOAD_FOLDERS) {
      const dir = path.join(config.uploadDir, folder)
      await fs.mkdir(dir, { recursive: true })
      await fs.access(dir, fs.constants.W_OK)
    }
    console.log(`Uploads folder: ${config.uploadDir}`)
  } catch (err) {
    console.error(`!! Cannot write to the uploads folder ${config.uploadDir}: ${err.message}`)
    console.error('!! Image uploads will fail until the folder is reachable and writable.')
  }
}

function fileFilter(req, file, cb) {
  const extensions = ALLOWED_TYPES[file.mimetype]
  const ext = path.extname(file.originalname).toLowerCase()
  if (!extensions || !extensions.includes(ext)) {
    return cb(httpError(400, 'Only JPG, PNG, GIF and WEBP images are allowed'))
  }
  cb(null, true)
}

/** Check the first bytes of the file, so a renamed .exe can't pass as a .png. */
async function looksLikeImage(filePath) {
  const handle = await fs.open(filePath, 'r')
  const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0)
  await handle.close()

  const hex = buffer.toString('hex')
  const text = buffer.toString('latin1')
  return (
    hex.startsWith('ffd8ff') || // JPEG
    hex.startsWith('89504e47') || // PNG
    text.startsWith('GIF8') || // GIF
    (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') // WEBP
  )
}

/**
 * Middleware that accepts one optional image in the form field "image"
 * and saves it to UPLOAD_DIR/<folder>/<random name>.
 */
export function imageUpload(folder) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: path.join(config.uploadDir, folder),
      filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 10 },
    fileFilter,
  })

  async function checkContent(req, res, next) {
    if (req.file && !(await looksLikeImage(req.file.path))) {
      await fs.rm(req.file.path, { force: true })
      req.file = undefined
      throw httpError(400, 'That file is not a valid image')
    }
    next()
  }

  return [upload.single('image'), checkContent]
}

/** The image info we store in CouchDB, or null if nothing was uploaded. */
export function imageInfo(file, folder) {
  if (!file) return null
  return {
    path: `${folder}/${file.filename}`,
    name: file.originalname.slice(0, 100),
    size: file.size,
    isLarge: file.size > config.largeImageBytes,
  }
}

/** Delete a stored image file. Missing files are ignored. */
export async function removeImage(image) {
  if (!image?.path) return
  try {
    await fs.rm(path.join(config.uploadDir, image.path), { force: true })
  } catch (err) {
    console.error('Could not delete image:', err.message)
  }
}
