<script setup>
// A live chat room: message history, new messages as they arrive, reactions and images.
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useLive } from '@/composables/useLive'
import { formatTime } from '@/utils/format'
import Avatar from '@/components/Avatar.vue'
import ImageView from '@/components/ImageView.vue'
import MessageInput from '@/components/MessageInput.vue'
import PlaceHeader from '@/components/PlaceHeader.vue'
import ReactionBar from '@/components/ReactionBar.vue'

const props = defineProps({
  id: { type: String, required: true },
})

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const room = ref(null)
const messages = ref([])
const hasMore = ref(false) // are there older messages on the server?
const loadingOlder = ref(false)
const loading = ref(true)
const notFound = ref(false)
const scroller = ref(null)

// ---------- loading ----------

async function loadRoom() {
  const { data } = await api.get(`/rooms/${props.id}`)
  room.value = data
}

/** The newest 50 messages. */
async function loadMessages() {
  if (!room.value.canView) return
  const { data } = await api.get(`/rooms/${props.id}/messages`)
  messages.value = data.messages
  hasMore.value = data.hasMore
  scrollToBottom()
}

/** The 50 messages before the oldest one on screen. */
async function loadOlder() {
  const el = scroller.value
  const heightBefore = el.scrollHeight
  loadingOlder.value = true
  try {
    const { data } = await api.get(`/rooms/${props.id}/messages`, {
      params: { before: messages.value[0].createdAt },
    })
    const known = new Set(messages.value.map((m) => m._id))
    messages.value = [...data.messages.filter((m) => !known.has(m._id)), ...messages.value]
    hasMore.value = data.hasMore

    // Keep the message the user was reading in the same spot
    await nextTick()
    el.scrollTop += el.scrollHeight - heightBefore
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loadingOlder.value = false
  }
}

onMounted(async () => {
  try {
    await loadRoom()
    await loadMessages()
  } catch (error) {
    if (error.response?.status === 404) notFound.value = true
    else toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
})

// ---------- scrolling ----------

function isNearBottom() {
  const el = scroller.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 150
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

// ---------- live updates ----------

function addMessage(message) {
  if (messages.value.some((m) => m._id === message._id)) return // already have it
  const follow = isNearBottom() || message.authorId === auth.user._id
  messages.value.push(message)
  if (follow) scrollToBottom()
}

function leavePage(message) {
  toast.info(message)
  router.push('/rooms')
}

const live = useLive('room', props.id, {
  'message:new': (message) => message.roomId === props.id && addMessage(message),
  'message:updated': ({ _id, reactions }) => {
    const message = messages.value.find((m) => m._id === _id)
    if (message) message.reactions = reactions
  },
  'room:changed': ({ id }) => id === props.id && loadRoom(),
  'room:cleared': ({ id }) => {
    if (id !== props.id) return
    messages.value = []
    hasMore.value = false
    toast.info('This room was cleared')
  },
  'room:deleted': ({ id }) => id === props.id && leavePage('This room was deleted'),
  'room:removed': ({ id }) => id === props.id && leavePage('You were removed from this room'),
})

async function onJoined() {
  live.join()
  await loadMessages()
}

// ---------- actions ----------

async function send({ text, file }) {
  const form = new FormData()
  form.append('text', text)
  if (file) form.append('image', file)
  const { data } = await api.post(`/rooms/${props.id}/messages`, form)
  addMessage(data)
}

async function react(message, emoji) {
  try {
    const { data } = await api.post(`/rooms/${props.id}/messages/${message._id}/react`, { emoji })
    message.reactions = data.reactions
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Show name + avatar only when the author changes or after a 5 minute gap. */
function startsGroup(index) {
  if (index === 0) return true
  const previous = messages.value[index - 1]
  const current = messages.value[index]
  const gap = new Date(current.createdAt) - new Date(previous.createdAt)
  return previous.authorId !== current.authorId || gap > 5 * 60 * 1000
}
</script>

<template>
  <div class="flex h-[calc(100dvh-3.5rem)] flex-col">
    <p v-if="loading" class="p-6 text-muted">Loading…</p>

    <div v-else-if="notFound" class="p-6 text-center">
      <p class="text-lg font-semibold">Room not found</p>
      <p class="text-sm text-muted">It may be private or deleted.</p>
      <RouterLink to="/rooms" class="btn btn-primary mt-4">Back to rooms</RouterLink>
    </div>

    <template v-else-if="room">
      <PlaceHeader type="room" :place="room" @updated="room = $event" @joined="onJoined" />

      <div v-if="!room.canView" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p class="text-4xl">💬</p>
        <p class="text-lg font-semibold">Join "{{ room.name }}" to see the conversation</p>
        <p class="text-sm text-muted">{{ room.memberCount }} members are already here.</p>
      </div>

      <template v-else>
        <div ref="scroller" class="flex-1 overflow-y-auto px-4 py-4">
          <div class="mx-auto flex max-w-4xl flex-col">
            <div v-if="hasMore" class="mb-2 text-center">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="loadingOlder" @click="loadOlder">
                {{ loadingOlder ? 'Loading…' : '↑ Load older messages' }}
              </button>
            </div>
            <p v-if="messages.length === 0" class="py-10 text-center text-muted">No messages yet. Say hi! 👋</p>

            <div
              v-for="(message, index) in messages"
              :key="message._id"
              class="flex gap-3"
              :class="[startsGroup(index) ? 'mt-4' : 'mt-1', message.authorId === auth.user._id ? 'flex-row-reverse' : '']"
            >
              <div class="w-9 shrink-0">
                <Avatar v-if="startsGroup(index)" :user="message.author" />
              </div>

              <div class="flex max-w-[75%] min-w-0 flex-col" :class="message.authorId === auth.user._id ? 'items-end' : 'items-start'">
                <p v-if="startsGroup(index)" class="mb-0.5 text-xs text-muted">
                  <span class="font-semibold text-fg">{{ message.author.displayName }}</span>
                  · {{ formatTime(message.createdAt) }}
                </p>
                <!-- keep {{ }} on the same line as the tag: pre-wrap would show the extra spaces -->
                <div
                  v-if="message.text"
                  class="rounded-2xl px-3.5 py-2 wrap-break-word whitespace-pre-wrap"
                  :class="message.authorId === auth.user._id ? 'bg-linear-to-br from-blue-600 to-violet-600 text-white' : 'glass-soft'"
                >{{ message.text }}</div>
                <ImageView v-if="message.image" :image="message.image" />
                <ReactionBar
                  :reactions="message.reactions"
                  :my-id="auth.user._id"
                  :disabled="!room.isMember"
                  @react="react(message, $event)"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="glass-bar border-t border-line px-4 py-3">
          <div class="mx-auto max-w-4xl">
            <MessageInput v-if="room.isMember" :submit="send" />
            <p v-else class="text-center text-sm text-muted">You are viewing as an admin. Join to send messages.</p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
