// Inventory items shared in chat rooms and channels.
// Messages and posts store only the item's id; its details are added when they are read,
// so edits show up and a deleted item shows as "no longer available".

import { getDoc, getDocs } from '../db.js'
import { httpError } from './http.js'

/** What others may see of a shared item (or { missing: true } once it has been deleted). */
function sharedItem(item) {
  if (!item || item.type !== 'item') return { missing: true }
  const { _id, category, title, whereToWatch, remarks, image, createdAt } = item
  return { _id, category, title, whereToWatch, remarks, image, createdAt }
}

/** Load an item the user is about to share. Only your own items can be shared. */
export async function getShareableItem(user, itemId) {
  const item = await getDoc(itemId)
  if (!item || item.type !== 'item' || item.userId !== user._id) throw httpError(404, 'Item not found')
  return item
}

/** Add `item` to every message/post that has an itemId (one database request for all of them). */
export async function attachItems(docs) {
  const ids = [...new Set(docs.map((doc) => doc.itemId).filter(Boolean))]
  if (ids.length === 0) return docs
  const items = await getDocs(ids)
  const byId = new Map(items.map((item) => [item._id, item]))
  return docs.map((doc) => (doc.itemId ? { ...doc, item: sharedItem(byId.get(doc.itemId)) } : doc))
}

/** Short text for a notification: the text, or what was attached. */
export function previewText({ text, image, item }) {
  if (text) return text.slice(0, 100)
  if (item && !item.missing) return `🗂️ Shared "${item.title}"`
  if (image) return '📷 Image'
  return ''
}
