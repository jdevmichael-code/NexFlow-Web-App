// The user's inventory: cards about places visited, movies watched, books read, etc.

import { Router } from 'express'
import { z } from 'zod'
import { db, findAllDocs, getDoc, newId, now, saveDoc, sortBy, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { imageInfo, imageUpload, removeImage } from '../middleware/upload.js'
import { logActivity } from '../utils/activity.js'
import { httpError, validate } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

export const CATEGORIES = ['place', 'movie', 'series', 'book', 'game', 'other']

// Items are sent as a form (because of the image), so every field arrives as a string
const itemSchema = z.object({
  category: z.enum(CATEGORIES, { message: 'Pick a category' }),
  title: z.string().trim().min(1, 'Title is required').max(100),
  whereToWatch: z.string().trim().max(200).optional().default(''),
  remarks: z.string().trim().max(2000).optional().default(''),
})

async function getOwnItem(req) {
  const item = await getDoc(req.params.id)
  if (!item || item.type !== 'item' || item.userId !== req.user._id) throw httpError(404, 'Item not found')
  return item
}

router.get('/', async (req, res) => {
  const items = await findAllDocs(
    { type: 'item', userId: req.user._id },
    { sort: sortBy(['type', 'userId', 'createdAt'], 'desc') },
  )
  res.json(items)
})

router.post('/', imageUpload('items'), async (req, res) => {
  const data = validate(itemSchema, req.body)
  const item = await saveDoc({
    _id: newId(),
    type: 'item',
    userId: req.user._id,
    ...data,
    image: imageInfo(req.file, 'items'),
    createdAt: now(),
  })
  await logActivity(req.user._id, 'created_item', `Added "${item.title}" to your inventory`, '/inventory')
  res.status(201).json(item)
})

router.put('/:id', imageUpload('items'), async (req, res) => {
  const item = await getOwnItem(req)
  const data = validate(itemSchema, req.body)
  const newImage = imageInfo(req.file, 'items')

  const saved = await updateDoc(item._id, (doc) => {
    Object.assign(doc, data)
    if (newImage) doc.image = newImage
  })
  if (newImage) await removeImage(item.image)

  res.json(saved)
})

router.delete('/:id', async (req, res) => {
  const item = await getOwnItem(req)
  await db.destroy(item._id, item._rev)
  await removeImage(item.image)
  res.json({ ok: true })
})

export default router
