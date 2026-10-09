import { findDocs, newId, now, queryView, saveDoc, sortBy } from '../db.js'

/**
 * Record something a user did, for their dashboard.
 * action: 'sent_message' | 'posted' | 'commented' | 'reacted' | 'created_room' | 'created_channel'
 *         | 'joined_room' | 'joined_channel' | 'created_plan' | 'created_item'
 * link: the client page it points to, e.g. '/rooms/<id>'
 */
export async function logActivity(userId, action, summary, link = null) {
  try {
    await saveDoc({ _id: newId(), type: 'activity', userId, action, summary, link, createdAt: now() })
  } catch (err) {
    // The dashboard log is nice to have. Never fail the real request because of it.
    console.error('Could not save activity:', err.message)
  }
}

/** View rows like { key: [userId, 'sent_message'], value: 42 } → { sent_message: 42 } */
const countsByName = (rows) => Object.fromEntries(rows.map((row) => [row.key[1], row.value]))

/** How many messages, posts, comments and reactions a user made, and how many rooms/channels they are in. */
export async function activityCounts(userId) {
  const forUser = { startkey: [userId], endkey: [userId, {}] }

  // CouchDB counts these for us — no matter how many activities exist, we get a few numbers back
  const [activityRows, placeRows] = await Promise.all([
    queryView('activity_counts', { ...forUser, group: true }),
    queryView('places_by_member', { ...forUser, group_level: 2 }),
  ])

  const actions = countsByName(activityRows.rows)
  const places = countsByName(placeRows.rows)
  return {
    messages: actions.sent_message || 0,
    posts: actions.posted || 0,
    comments: actions.commented || 0,
    reactions: actions.reacted || 0,
    rooms: places.room || 0,
    channels: places.channel || 0,
  }
}

/** The user's newest activities. */
export function recentActivity(userId, limit = 20) {
  return findDocs({ type: 'activity', userId }, { sort: sortBy(['type', 'userId', 'createdAt'], 'desc'), limit })
}
