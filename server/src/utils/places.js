// A "place" is a chat room or a channel. Both work the same way:
// a name, public/private, an owner, and a members list.

import { deleteMatching, getDoc, getDocs, queryView, sortBy } from '../db.js'
import { removeImage } from '../middleware/upload.js'
import { canManage, canView, isMember, isOwner } from './access.js'
import { httpError } from './http.js'
import { attachUser, shortUser } from './users.js'

export const placeLabel = (type) => (type === 'room' ? 'Room' : 'Channel')

// What lives inside each kind of place, and the field that links it to the place
const CONTENT = {
  room: [{ type: 'message', field: 'roomId' }],
  channel: [
    { type: 'post', field: 'channelId' },
    { type: 'comment', field: 'channelId' },
  ],
}

/** Load a room or channel, or throw 404. */
export async function getPlace(type, id) {
  const place = await getDoc(id)
  if (!place || place.type !== type) throw httpError(404, `${placeLabel(type)} not found`)
  return place
}

/** The list version: no member ids, just counts and what the user can do. */
export function placeSummary(place, user) {
  const { members, ...rest } = place
  return {
    ...rest,
    memberCount: members.length,
    isMember: isMember(user, place),
    isOwner: isOwner(user, place),
    canManage: canManage(user, place),
  }
}

/** The full version for the room/channel page: adds the owner, and members if the user may see them. */
export async function placeDetails(place, user) {
  const withOwner = await attachUser(place, 'ownerId', 'owner')
  const details = placeSummary(withOwner, user)
  details.canView = canView(user, place)

  if (details.canView) {
    const users = await getDocs(place.members)
    details.members = users.filter((u) => u.status !== 'deleted').map(shortUser)
  }
  return details
}

/** All rooms (or channels) a user is a member of, using the places_by_member view. */
export async function placesOfMember(userId, type) {
  const result = await queryView('places_by_member', {
    startkey: [userId, type],
    endkey: [userId, type, {}],
    reduce: false,
    include_docs: true,
  })
  return result.rows.map((row) => row.doc).filter(Boolean)
}

/**
 * Delete everything inside a place (messages, or posts and comments) and their image files.
 * Works in batches of 1000, so even a room with millions of messages never has to fit in memory.
 */
export async function deletePlaceContent(type, placeId) {
  for (const content of CONTENT[type]) {
    await deleteMatching(
      { type: content.type, [content.field]: placeId },
      {
        sort: sortBy(['type', content.field, 'createdAt']),
        beforeDelete: (docs) => Promise.all(docs.map((doc) => removeImage(doc.image))),
      },
    )
  }
}
