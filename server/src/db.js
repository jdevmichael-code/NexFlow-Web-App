import nano from 'nano'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { httpError } from './utils/http.js'
import { DESIGN_DOC, DESIGN_NAME } from './views.js'

// nano reads the login from the URL: http://user:password@host:5984
const couchUrl = new URL(config.couchHost)
couchUrl.username = encodeURIComponent(config.couchUser)
couchUrl.password = encodeURIComponent(config.couchPassword)

const couch = nano(couchUrl.toString())

export const db = couch.use(config.dbName)

// How many docs we fetch or delete per request when working through big sets
const BATCH_SIZE = 1000

// Mango indexes. Every query's `sort` must match one of these.
const INDEXES = [
  ['type', 'createdAt'],
  ['type', 'isPublic', 'createdAt'],
  ['type', 'roomId', 'createdAt'],
  ['type', 'channelId', 'createdAt'],
  ['type', 'postId', 'createdAt'],
  ['type', 'userId', 'date'],
  ['type', 'userId', 'createdAt'],
]

/** Create the database, indexes and views if they don't exist yet. */
export async function connectDb() {
  try {
    await couch.db.get(config.dbName)
  } catch (err) {
    if (err.statusCode !== 404) throw err
    await couch.db.create(config.dbName)
    console.log(`Created database ${config.dbName}`)
  }

  for (const fields of INDEXES) {
    await db.createIndex({ index: { fields }, name: fields.join('-') })
  }
  await saveDesignDoc()
  console.log(`Connected to CouchDB ${config.dbName}`)
}

/** Save the views from views.js, but only when they changed (CouchDB rebuilds a view on every change). */
async function saveDesignDoc() {
  const existing = await getDoc(DESIGN_DOC._id)
  if (existing && JSON.stringify(existing.views) === JSON.stringify(DESIGN_DOC.views)) return
  await db.insert({ ...DESIGN_DOC, _rev: existing?._rev })
  console.log('Views updated (CouchDB rebuilds them in the background)')
}

export const newId = () => randomUUID()
export const now = () => new Date().toISOString()

/** sortBy(['type', 'roomId', 'createdAt'], 'desc') → Mango sort array. */
export const sortBy = (fields, direction = 'asc') => fields.map((field) => ({ [field]: direction }))

/**
 * Run a Mango query that returns at most `limit` docs (both sort and limit are required).
 * - sort: without one CouchDB may pick an index that silently skips docs missing
 *   one of its fields (e.g. rooms don't have `date`), returning too few results.
 * - limit: makes the caller decide how many docs is enough. Use findAllDocs when you really need every one.
 */
export async function findDocs(selector, { sort, limit, fields, skip } = {}) {
  if (!sort) throw new Error('findDocs needs a sort that matches an index in db.js')
  if (!limit) throw new Error('findDocs needs a limit (or use findAllDocs)')
  const query = { selector, sort, limit }
  if (fields) query.fields = fields
  if (skip) query.skip = skip
  const result = await db.find(query)
  return result.docs
}

/**
 * Get EVERY doc that matches, fetching 1000 at a time so nothing is cut off.
 * Uses Mango bookmarks when the server supports them (CouchDB 2.1+), otherwise `skip`.
 */
export async function findAllDocs(selector, { sort, fields } = {}) {
  if (!sort) throw new Error('findAllDocs needs a sort that matches an index in db.js')
  const all = []
  let bookmark = null

  while (true) {
    const query = { selector, sort, limit: BATCH_SIZE }
    if (fields) query.fields = fields
    if (bookmark) query.bookmark = bookmark
    else query.skip = all.length

    const result = await db.find(query)
    all.push(...result.docs)
    if (result.docs.length < BATCH_SIZE) return all
    bookmark = result.bookmark || null
  }
}

/**
 * Delete every doc that matches, 1000 at a time, so huge rooms don't need to fit in memory.
 * `beforeDelete(docs)` runs for each batch first (e.g. to remove image files).
 * Returns how many docs were deleted.
 */
export async function deleteMatching(selector, { sort, beforeDelete } = {}) {
  let total = 0
  while (true) {
    const docs = await findDocs(selector, { sort, limit: BATCH_SIZE })
    if (docs.length === 0) return total
    if (beforeDelete) await beforeDelete(docs)
    const deleted = await deleteDocs(docs)
    if (deleted === 0) throw new Error('Could not delete documents (all conflicted)')
    total += deleted
  }
}

/** Query one of the views in views.js. */
export function queryView(name, options) {
  return db.view(DESIGN_NAME, name, options)
}

/** Get one doc by id, or null if it doesn't exist. */
export async function getDoc(id) {
  try {
    return await db.get(id)
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

/** Get many docs by id. Missing ones are skipped. */
export async function getDocs(ids) {
  if (ids.length === 0) return []
  const result = await db.fetch({ keys: ids })
  return result.rows.filter((row) => row.doc).map((row) => row.doc)
}

/** Insert or update a doc and return it with its new _id/_rev. */
export async function saveDoc(doc) {
  const result = await db.insert(doc)
  return { ...doc, _id: result.id, _rev: result.rev }
}

/**
 * Load a doc, change it, and save it. If someone else saved it at the same
 * moment (CouchDB conflict), try again with the fresh version.
 * Returns the saved doc, or null if the doc doesn't exist.
 */
export async function updateDoc(id, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await getDoc(id)
    if (!doc) return null
    change(doc)
    try {
      return await saveDoc(doc)
    } catch (err) {
      if (err.statusCode !== 409) throw err
    }
  }
  throw httpError(409, 'Too many people are editing this at once, please try again')
}

/** Delete many docs in one request. Returns how many were really deleted. */
export async function deleteDocs(docs) {
  if (docs.length === 0) return 0
  const results = await db.bulk({ docs: docs.map((doc) => ({ _id: doc._id, _rev: doc._rev, _deleted: true })) })
  return results.filter((result) => !result.error).length
}
