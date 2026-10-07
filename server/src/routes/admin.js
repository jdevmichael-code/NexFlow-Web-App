// Admin-only: the users management table.
// (Admins manage rooms and channels through the normal /api/rooms and /api/channels routes,
//  which already allow admins to view, clear and delete anything.)

import { Router } from 'express'
import { randomBytes, randomInt } from 'node:crypto'
import { z } from 'zod'
import { deleteMatching, getDoc, queryView, sortBy, updateDoc } from '../db.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { removeImage } from '../middleware/upload.js'
import { kickUser } from '../socket.js'
import { httpError, validate } from '../utils/http.js'
import { hashPassword } from '../utils/passwords.js'
import { publicUser, searchUsers } from '../utils/users.js'

const router = Router()
router.use(requireAuth, requireAdmin)

const PAGE_SIZE = 20
const MAX_SEARCH_RESULTS = 200

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

/** Load a user that an admin may change (not deleted, not yourself). */
async function getTargetUser(req) {
  const user = await getDoc(req.params.id)
  if (!user || user.type !== 'user' || user.status === 'deleted') throw httpError(404, 'User not found')
  if (user._id === req.user._id) throw httpError(400, 'You cannot change your own account here')
  return user
}

// GET /api/admin/users?q=ann&page=1
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 30)
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
  const start = (page - 1) * PAGE_SIZE

  // Searching: names/usernames starting with q (users_by_name view), at most 200 matches
  if (q.trim()) {
    const { users, hasMore } = await searchUsers(q, MAX_SEARCH_RESULTS)
    users.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return res.json({
      users: users.slice(start, start + PAGE_SIZE).map(publicUser),
      total: users.length,
      tooManyMatches: hasMore, // the client asks the admin to type more
      page,
      pageSize: PAGE_SIZE,
    })
  }

  // Not searching: one page of the users_by_created view, newest first.
  // CouchDB does the paging, so we never load every user.
  const result = await queryView('users_by_created', {
    descending: true,
    skip: start,
    limit: PAGE_SIZE,
    include_docs: true,
  })
  res.json({
    users: result.rows.map((row) => publicUser(row.doc)),
    total: result.total_rows,
    tooManyMatches: false,
    page,
    pageSize: PAGE_SIZE,
  })
})

// Change role and/or status
router.patch('/users/:id', async (req, res) => {
  const target = await getTargetUser(req)
  const { role, status } = validate(updateUserSchema, req.body)

  const saved = await updateDoc(target._id, (doc) => {
    if (role) doc.role = role
    if (status) {
      if (status === 'disabled' && doc.status !== 'disabled') doc.tokenVersion += 1 // log them out
      if (status === 'active') {
        doc.failedLogins = 0
        doc.lockedUntil = null
      }
      doc.status = status
    }
  })

  if (saved.status === 'disabled') kickUser(saved._id)
  res.json(publicUser(saved))
})

// Set a random temporary password. It is shown to the admin once.
router.post('/users/:id/reset-password', async (req, res) => {
  const target = await getTargetUser(req)
  const tempPassword = `Nx${randomInt(10, 100)}${randomBytes(5).toString('hex')}`
  const passwordHash = await hashPassword(tempPassword)

  await updateDoc(target._id, (doc) => {
    doc.passwordHash = passwordHash
    doc.tokenVersion += 1
    doc.failedLogins = 0
    doc.lockedUntil = null
  })

  kickUser(target._id)
  res.json({ tempPassword })
})

// Delete a user. Their account doc is kept as "deleted" so the username can't be
// re-registered by someone else and pretend to be them in old messages.
router.delete('/users/:id', async (req, res) => {
  const target = await getTargetUser(req)

  await updateDoc(target._id, (doc) => {
    doc.status = 'deleted'
    doc.passwordHash = null
    doc.displayName = 'Deleted user'
    doc.bio = ''
    doc.avatar = null
    doc.role = 'user'
    doc.tokenVersion += 1
  })
  kickUser(target._id)
  await removeImage({ path: target.avatar })

  // Remove their private data (plans, inventory, activity log) in batches of 1000
  for (const type of ['plan', 'item', 'activity']) {
    await deleteMatching(
      { type, userId: target._id },
      {
        sort: sortBy(type === 'plan' ? ['type', 'userId', 'date'] : ['type', 'userId', 'createdAt']),
        beforeDelete: (docs) => Promise.all(docs.map((doc) => removeImage(doc.image))),
      },
    )
  }

  res.json({ ok: true })
})

export default router
