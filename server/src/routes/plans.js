// The user's personal planner. Users only ever see their own plans.

import { Router } from 'express'
import { z } from 'zod'
import { db, findAllDocs, getDoc, newId, now, saveDoc, sortBy, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../socket.js'
import { logActivity } from '../utils/activity.js'
import { httpError, validate } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like 2026-01-31')

const planSchema = z.object({
  date: dateString,
  time: z
    .string()
    .regex(/^(\d{2}:\d{2})?$/, 'Time must look like 14:30')
    .optional()
    .default(''),
  title: z.string().trim().min(1, 'Title is required').max(100),
  note: z.string().trim().max(1000).optional().default(''),
})

const rangeSchema = z.object({ from: dateString, to: dateString })

// Tell all of the user's open tabs, so their reminders are rescheduled (see usePlanReminders on the client)
const announceChange = (req) => io.to(req.user._id).emit('plans:changed')

/** Load one of the current user's plans, or throw 404. */
async function getOwnPlan(req) {
  const plan = await getDoc(req.params.id)
  if (!plan || plan.type !== 'plan' || plan.userId !== req.user._id) throw httpError(404, 'Plan not found')
  return plan
}

// GET /api/plans?from=2026-10-01&to=2026-10-31
router.get('/', async (req, res) => {
  const { from, to } = validate(rangeSchema, req.query)
  const plans = await findAllDocs(
    { type: 'plan', userId: req.user._id, date: { $gte: from, $lte: to } },
    { sort: sortBy(['type', 'userId', 'date']) },
  )
  // Same day: plans without a time first, then by time
  plans.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  res.json(plans)
})

router.post('/', async (req, res) => {
  const data = validate(planSchema, req.body)
  const plan = await saveDoc({ _id: newId(), type: 'plan', userId: req.user._id, ...data, createdAt: now() })
  await logActivity(req.user._id, 'created_plan', `Planned "${plan.title}" on ${plan.date}`, '/planner')
  announceChange(req)
  res.status(201).json(plan)
})

router.put('/:id', async (req, res) => {
  const plan = await getOwnPlan(req)
  const data = validate(planSchema, req.body)
  const saved = await updateDoc(plan._id, (doc) => Object.assign(doc, data))
  announceChange(req)
  res.json(saved)
})

router.delete('/:id', async (req, res) => {
  const plan = await getOwnPlan(req)
  await db.destroy(plan._id, plan._rev)
  announceChange(req)
  res.json({ ok: true })
})

export default router
