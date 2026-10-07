// Channel posts and their comments, mounted at /api/channels/:channelId/posts

import { Router } from 'express'
import { z } from 'zod'
import { findAllDocs, findDocs, getDoc, newId, now, saveDoc, sortBy, updateDoc } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { imageInfo, imageUpload } from '../middleware/upload.js'
import { io } from '../socket.js'
import { canView, isMember } from '../utils/access.js'
import { logActivity } from '../utils/activity.js'
import { httpError, validate } from '../utils/http.js'
import { getPlace } from '../utils/places.js'
import { reactionSchema, toggleReaction } from '../utils/reactions.js'
import { attachUser, attachUsers } from '../utils/users.js'

const router = Router({ mergeParams: true })
router.use(requireAuth)

const PAGE_SIZE = 20

const feedSchema = z.object({
  before: z.iso.datetime({ message: 'before must be a date' }).optional(),
})

const postSchema = z.object({
  text: z.string().trim().max(5000, 'Post is too long (max 5000 characters)').optional().default(''),
})

const commentSchema = z.object({
  text: z.string().trim().min(1, 'Comment is empty').max(1000, 'Comment is too long (max 1000 characters)'),
})

/** Load the channel and the post, and check the post belongs to the channel. */
async function getChannelAndPost(req) {
  const channel = await getPlace('channel', req.params.channelId)
  const post = await getDoc(req.params.postId)
  if (!post || post.type !== 'post' || post.channelId !== channel._id) throw httpError(404, 'Post not found')
  return { channel, post }
}

// GET /api/channels/:channelId/posts?before=<createdAt of the oldest post you have>
// Returns 20 posts (newest first) and whether there are even older ones.
router.get('/', async (req, res) => {
  const channel = await getPlace('channel', req.params.channelId)
  if (!canView(req.user, channel)) throw httpError(403, 'Join this channel to see its posts')

  const { before } = validate(feedSchema, req.query)
  const selector = { type: 'post', channelId: channel._id }
  if (before) selector.createdAt = { $lt: before }

  // Ask for one extra: if it comes back, there are older posts to load
  const posts = await findDocs(selector, {
    sort: sortBy(['type', 'channelId', 'createdAt'], 'desc'),
    limit: PAGE_SIZE + 1,
  })
  const hasMore = posts.length > PAGE_SIZE

  res.json({ posts: await attachUsers(posts.slice(0, PAGE_SIZE), 'authorId', 'author'), hasMore })
})

router.post('/', imageUpload('posts'), async (req, res) => {
  const channel = await getPlace('channel', req.params.channelId)
  if (!isMember(req.user, channel)) throw httpError(403, 'Join this channel to post')

  const { text } = validate(postSchema, req.body)
  const image = imageInfo(req.file, 'posts')
  if (!text && !image) throw httpError(400, 'Write something or choose an image')

  const post = await saveDoc({
    _id: newId(),
    type: 'post',
    channelId: channel._id,
    authorId: req.user._id,
    text,
    image,
    reactions: {},
    commentCount: 0,
    createdAt: now(),
  })

  const withAuthor = await attachUser(post, 'authorId', 'author')
  io.to(`channel:${channel._id}`).emit('post:new', withAuthor)
  await logActivity(req.user._id, 'posted', `Posted in "${channel.name}"`, `/channels/${channel._id}`)

  res.status(201).json(withAuthor)
})

router.post('/:postId/react', async (req, res) => {
  const { channel, post } = await getChannelAndPost(req)
  if (!isMember(req.user, channel)) throw httpError(403, 'Join this channel to react')

  const { emoji } = validate(reactionSchema, req.body)

  let added = false
  const saved = await updateDoc(post._id, (doc) => {
    added = toggleReaction(doc, emoji, req.user._id)
  })

  io.to(`channel:${channel._id}`).emit('post:updated', { _id: saved._id, reactions: saved.reactions })
  if (added) await logActivity(req.user._id, 'reacted', `Reacted ${emoji} to a post in "${channel.name}"`, `/channels/${channel._id}`)

  res.json({ _id: saved._id, reactions: saved.reactions })
})

// Comments, oldest first
router.get('/:postId/comments', async (req, res) => {
  const { channel, post } = await getChannelAndPost(req)
  if (!canView(req.user, channel)) throw httpError(403, 'Join this channel to see comments')

  const comments = await findAllDocs(
    { type: 'comment', postId: post._id },
    { sort: sortBy(['type', 'postId', 'createdAt']) },
  )
  res.json(await attachUsers(comments, 'authorId', 'author'))
})

router.post('/:postId/comments', async (req, res) => {
  const { channel, post } = await getChannelAndPost(req)
  if (!isMember(req.user, channel)) throw httpError(403, 'Join this channel to comment')

  const { text } = validate(commentSchema, req.body)

  const comment = await saveDoc({
    _id: newId(),
    type: 'comment',
    postId: post._id,
    channelId: channel._id,
    authorId: req.user._id,
    text,
    createdAt: now(),
  })

  const savedPost = await updateDoc(post._id, (doc) => {
    doc.commentCount = (doc.commentCount || 0) + 1
  })

  const withAuthor = await attachUser(comment, 'authorId', 'author')
  io.to(`channel:${channel._id}`).emit('comment:new', withAuthor)
  io.to(`channel:${channel._id}`).emit('post:updated', { _id: savedPost._id, commentCount: savedPost.commentCount })
  await logActivity(req.user._id, 'commented', `Commented on a post in "${channel.name}"`, `/channels/${channel._id}`)

  res.status(201).json(withAuthor)
})

export default router
