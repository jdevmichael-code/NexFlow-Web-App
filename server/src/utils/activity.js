import { newId, now, saveDoc } from '../db.js'

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
