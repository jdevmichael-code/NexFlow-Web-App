import { z } from 'zod'
import { getDocs, now, queryView } from '../db.js'

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 characters: letters, numbers or _')

export const displayNameSchema = z.string().trim().min(1, 'Display name is required').max(40)

/** User ids are "user:<username>", so CouchDB itself guarantees usernames are unique. */
export const userIdFor = (username) => `user:${username}`

/** A brand new user doc. */
export function newUser({ username, displayName, passwordHash, role = 'user' }) {
  return {
    _id: userIdFor(username),
    type: 'user',
    username,
    displayName,
    passwordHash,
    role,
    status: 'active', // 'active' | 'disabled' | 'deleted'
    tokenVersion: 0, // bump to log the user out everywhere
    failedLogins: 0,
    lockedUntil: null,
    avatar: null,
    bio: '',
    createdAt: now(),
    lastLoginAt: null,
  }
}

const DELETED_USER = { _id: null, username: 'deleted', displayName: 'Deleted user', avatar: null, role: 'user' }

/** The safe version of a user doc that the client is allowed to see. Never send passwordHash etc. */
export function publicUser(user) {
  if (user.status === 'deleted') return { ...DELETED_USER, _id: user._id }
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    bio: user.bio,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

/** The small version shown next to messages, posts and comments. */
export function shortUser(user) {
  if (!user || user.status === 'deleted') return DELETED_USER
  return { _id: user._id, username: user.username, displayName: user.displayName, avatar: user.avatar, role: user.role }
}

/**
 * Add user info to docs that only store a user id.
 * attachUsers(messages, 'authorId', 'author') → each message gets `author: { displayName, avatar, ... }`
 */
export async function attachUsers(docs, idField, asField) {
  const ids = [...new Set(docs.map((doc) => doc[idField]))]
  const users = await getDocs(ids)
  const usersById = Object.fromEntries(users.map((user) => [user._id, shortUser(user)]))
  return docs.map((doc) => ({ ...doc, [asField]: usersById[doc[idField]] || DELETED_USER }))
}

// A character that sorts after all normal text in CouchDB (the usual trick for prefix searches)
const LAST_CHARACTER = String.fromCharCode(0xfff0)

/**
 * Users whose username, or any word of their display name, starts with `text`.
 * Uses the users_by_name view, so it stays fast with many users.
 * Returns { users, hasMore } — hasMore means there were more matches than `limit`.
 */
export async function searchUsers(text, limit) {
  const term = text.trim().toLowerCase()
  if (!term) return { users: [], hasMore: false }

  // One user can match several terms ("ann" and "ann lee"), so fetch extra rows and remove duplicates
  const rowLimit = limit * 3
  const result = await queryView('users_by_name', {
    startkey: term,
    endkey: term + LAST_CHARACTER, // everything that starts with `term`
    include_docs: true,
    limit: rowLimit,
  })

  const byId = new Map()
  for (const row of result.rows) if (row.doc) byId.set(row.id, row.doc)
  const users = [...byId.values()]

  return {
    users: users.slice(0, limit),
    hasMore: users.length > limit || result.rows.length === rowLimit,
  }
}

/** Same as attachUsers, for a single doc. */
export async function attachUser(doc, idField, asField) {
  const [result] = await attachUsers([doc], idField, asField)
  return result
}
