// Access rules for "places" (chat rooms and channels).

export const isAdmin = (user) => user.role === 'admin'

export const isOwner = (user, place) => place.ownerId === user._id

export const isMember = (user, place) => place.members.includes(user._id)

/** Public places are open to everyone. Admins can join any place. */
export const canJoin = (user, place) => place.isPublic || isAdmin(user)

/** Read messages/posts: members, and admins (for moderation). */
export const canView = (user, place) => isMember(user, place) || isAdmin(user)

/** Edit, manage members, clear, delete: the owner, and admins. */
export const canManage = (user, place) => isOwner(user, place) || isAdmin(user)
