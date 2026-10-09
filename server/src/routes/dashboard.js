// The user's own activity summary

import { Router } from 'express'
import { findAllDocs, sortBy } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { activityCounts, recentActivity } from '../utils/activity.js'

const router = Router()
router.use(requireAuth)

/** Today as YYYY-MM-DD in the server's local time zone. */
function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

router.get('/', async (req, res) => {
  const userId = req.user._id

  const [counts, recent, plans, items] = await Promise.all([
    activityCounts(userId),
    recentActivity(userId, 20),
    findAllDocs({ type: 'plan', userId, date: { $gte: todayString() } }, { sort: sortBy(['type', 'userId', 'date']) }),
    findAllDocs({ type: 'item', userId }, { sort: sortBy(['type', 'userId', 'createdAt']), fields: ['_id'] }),
  ])

  res.json({
    counts: {
      ...counts,
      upcomingPlans: plans.length,
      items: items.length,
    },
    recent,
    upcomingPlans: plans.slice(0, 5),
  })
})

export default router
