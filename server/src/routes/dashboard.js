// The user's own activity summary

import { Router } from 'express'
import { findAllDocs, findDocs, queryView, sortBy } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

/** Today as YYYY-MM-DD in the server's local time zone. */
function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** View rows like { key: [userId, 'sent_message'], value: 42 } → { sent_message: 42 } */
const countsByName = (rows) => Object.fromEntries(rows.map((row) => [row.key[1], row.value]))

router.get('/', async (req, res) => {
  const userId = req.user._id
  const forUser = { startkey: [userId], endkey: [userId, {}] }

  const [activityRows, placeRows, recent, plans, items] = await Promise.all([
    // CouchDB counts these for us — no matter how many activities exist, we get a few numbers back
    queryView('activity_counts', { ...forUser, group: true }),
    queryView('places_by_member', { ...forUser, group_level: 2 }),
    findDocs({ type: 'activity', userId }, { sort: sortBy(['type', 'userId', 'createdAt'], 'desc'), limit: 20 }),
    findAllDocs({ type: 'plan', userId, date: { $gte: todayString() } }, { sort: sortBy(['type', 'userId', 'date']) }),
    findAllDocs({ type: 'item', userId }, { sort: sortBy(['type', 'userId', 'createdAt']), fields: ['_id'] }),
  ])

  const actions = countsByName(activityRows.rows)
  const places = countsByName(placeRows.rows)

  res.json({
    counts: {
      messages: actions.sent_message || 0,
      posts: actions.posted || 0,
      comments: actions.commented || 0,
      reactions: actions.reacted || 0,
      rooms: places.room || 0,
      channels: places.channel || 0,
      upcomingPlans: plans.length,
      items: items.length,
    },
    recent,
    upcomingPlans: plans.slice(0, 5),
  })
})

export default router
