// "Ann sent a message in General": a pop-up for the members of a room/channel who aren't the author.
// Sent to each member's personal socket room, so it reaches them on any page.
// The client skips it when they are already looking at that room/channel.

import { io } from '../socket.js'
import { shortUser } from './users.js'

export function notifyMembers(place, author, preview) {
  const others = place.members.filter((id) => id !== author._id)
  if (others.length === 0) return
  io.to(others).emit('notify', {
    placeType: place.type, // 'room' | 'channel'
    placeId: place._id,
    placeName: place.name,
    isDirect: !!place.isDirect, // a private chat started with "Send message"
    from: shortUser(author),
    preview,
  })
}
