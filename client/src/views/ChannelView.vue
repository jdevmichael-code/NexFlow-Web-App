<script setup>
// A channel: a feed of posts with reactions and comments, all updating live.
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useLive } from '@/composables/useLive'
import { DESKTOP, useMediaQuery } from '@/composables/useMediaQuery'
import MessageInput from '@/components/MessageInput.vue'
import PlaceHeader from '@/components/PlaceHeader.vue'
import PostCard from '@/components/PostCard.vue'
import UserList from '@/components/UserList.vue'
import UserMenu from '@/components/UserMenu.vue'

const props = defineProps({
    id: { type: String, required: true },
})

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const isDesktop = useMediaQuery(DESKTOP) // the people list only fits next to the feed on big screens
const userMenu = ref(null) // opened by clicking an avatar in a post or comment

const channel = ref(null)
const posts = ref([]) // newest first
const hasMore = ref(false) // are there older posts on the server?
const loadingOlder = ref(false)
const loading = ref(true)
const notFound = ref(false)

// Each post also gets UI state: showComments, and comments (null until loaded)
const withUiState = (post) => ({ ...post, showComments: false, comments: null })
const findPost = (postId) => posts.value.find((post) => post._id === postId)

// ---------- loading ----------

async function loadChannel() {
    const { data } = await api.get(`/channels/${props.id}`)
    channel.value = data
}

/** The newest 20 posts. */
async function loadPosts() {
    if (!channel.value.canView) return
    const { data } = await api.get(`/channels/${props.id}/posts`)
    posts.value = data.posts.map(withUiState)
    hasMore.value = data.hasMore
}

/** The 20 posts before the oldest one on screen, added at the bottom. */
async function loadOlder() {
    loadingOlder.value = true
    try {
        const oldest = posts.value[posts.value.length - 1]
        const { data } = await api.get(`/channels/${props.id}/posts`, { params: { before: oldest.createdAt } })
        const older = data.posts.filter((post) => !findPost(post._id)).map(withUiState)
        posts.value.push(...older)
        hasMore.value = data.hasMore
    } catch (error) {
        toast.error(errorMessage(error))
    } finally {
        loadingOlder.value = false
    }
}

onMounted(async () => {
    try {
        await loadChannel()
        await loadPosts()
    } catch (error) {
        if (error.response?.status === 404) notFound.value = true
        else toast.error(errorMessage(error))
    } finally {
        loading.value = false
    }
})

// ---------- live updates ----------

function addPost(post) {
    if (!findPost(post._id)) posts.value.unshift(withUiState(post))
}

function addComment(comment) {
    const post = findPost(comment.postId)
    if (post?.comments && !post.comments.some((c) => c._id === comment._id)) post.comments.push(comment)
}

function leavePage(message) {
    toast.info(message)
    router.push('/channels')
}

const live = useLive('channel', props.id, {
    'post:new': (post) => post.channelId === props.id && addPost(post),
    'post:updated': (changes) => {
        const post = findPost(changes._id)
        if (post) Object.assign(post, changes) // reactions and/or commentCount
    },
    'comment:new': (comment) => comment.channelId === props.id && addComment(comment),
    'channel:changed': ({ id }) => id === props.id && loadChannel(),
    'channel:cleared': ({ id }) => {
        if (id !== props.id) return
        posts.value = []
        hasMore.value = false
        toast.info('This channel was cleared')
    },
    'channel:deleted': ({ id }) => id === props.id && leavePage('This channel was deleted'),
    'channel:removed': ({ id }) => id === props.id && leavePage('You were removed from this channel'),
})

async function onJoined() {
    live.join()
    await loadPosts()
}

// ---------- actions ----------
async function createPost({ text, file }) {
    const form = new FormData()
    form.append('text', text)
    if (file) form.append('image', file)
    const { data } = await api.post(`/channels/${props.id}/posts`, form)
    addPost(data)
}

async function react(post, emoji) {
    try {
        const { data } = await api.post(`/channels/${props.id}/posts/${post._id}/react`, { emoji })
        post.reactions = data.reactions
    } catch (error) {
        toast.error(errorMessage(error))
    }
}

async function toggleComments(post) {
    post.showComments = !post.showComments
    if (post.showComments && !post.comments) {
        try {
            const { data } = await api.get(`/channels/${props.id}/posts/${post._id}/comments`)
            post.comments = data
        } catch (error) {
            post.comments = []
            toast.error(errorMessage(error))
        }
    }
}

async function comment(post, text) {
    const { data } = await api.post(`/channels/${props.id}/posts/${post._id}/comments`, { text })
    addComment(data)
}
</script>

<template>
    <div class="flex flex-1 flex-col">
        <p v-if="loading" class="p-6 text-muted">Loading…</p>

        <div v-else-if="notFound" class="p-6 text-center">
            <p class="text-lg font-semibold">Channel not found</p>
            <p class="text-sm text-muted">It may be private or deleted.</p>
            <RouterLink to="/channels" class="btn btn-primary mt-4">Back to channels</RouterLink>
        </div>

        <template v-else-if="channel">
            <!-- Header + feed, plus (desktop only) the online/offline people list on the right -->
            <div class="flex flex-1">
                <div class="flex min-w-0 flex-1 flex-col">
                    <PlaceHeader type="channel" :place="channel" @updated="channel = $event" @joined="onJoined" />

                    <div v-if="!channel.canView" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                        <p class="text-4xl">📢</p>
                        <p class="text-lg font-semibold">Join "{{ channel.name }}" to see its posts</p>
                        <p class="text-sm text-muted">{{ channel.memberCount }} members are already here.</p>
                    </div>

                    <div v-else class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
                        <div v-if="channel.isMember" class="card p-4">
                            <MessageInput :submit="createPost" placeholder="Share something with the channel…" button-label="Post" :rows="3" />
                        </div>
                        <p v-else class="card p-4 text-center text-sm text-muted">You are viewing as an admin. Join to post.</p>

                        <p v-if="posts.length === 0" class="py-10 text-center text-muted">No posts yet. Be the first! ✨</p>
                        <PostCard
                            v-for="post in posts"
                            :key="post._id"
                            :post="post"
                            :my-id="auth.user._id"
                            :can-interact="channel.isMember"
                            :submit-comment="(text) => comment(post, text)"
                            @react="react(post, $event)"
                            @toggle-comments="toggleComments(post)"
                            @open-user="(user, element) => userMenu.open(user, element)"
                        />
                        <div v-if="hasMore" class="text-center">
                            <button type="button" class="btn btn-secondary" :disabled="loadingOlder" @click="loadOlder">
                                {{ loadingOlder ? 'Loading…' : '↓ Load older posts' }}
                            </button>
                        </div>
                        <p v-else-if="posts.length > 0" class="py-2 text-center text-xs text-subtle">You've reached the first post.</p>
                    </div>
                </div>

                <!-- The page scrolls, so the list stays in view under the nav bar (3.5rem) and scrolls on its own -->
                <div v-if="isDesktop" class="sticky top-14 flex max-h-[calc(100dvh-3.5rem)] w-72 shrink-0 flex-col self-start border-l border-line p-4">
                    <UserList />
                </div>
            </div>

            <UserMenu ref="userMenu" />
        </template>
    </div>
</template>
