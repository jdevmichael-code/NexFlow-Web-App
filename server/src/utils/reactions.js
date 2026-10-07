import { z } from 'zod'

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

export const reactionSchema = z.object({
  emoji: z.enum(EMOJIS, { message: 'Unknown reaction' }),
})

/**
 * Add the user's reaction, or remove it if it's already there.
 * Changes `doc.reactions` in place and returns true when a reaction was added.
 */
export function toggleReaction(doc, emoji, userId) {
  doc.reactions = doc.reactions || {}
  const users = doc.reactions[emoji] || []

  if (users.includes(userId)) {
    doc.reactions[emoji] = users.filter((id) => id !== userId)
    if (doc.reactions[emoji].length === 0) delete doc.reactions[emoji]
    return false
  }

  doc.reactions[emoji] = [...users, userId]
  return true
}
