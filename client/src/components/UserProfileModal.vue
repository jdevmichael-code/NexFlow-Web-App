<script setup>
// "View user profile": basic info about another user. Admins also see the user's activity.
// Usage: <UserProfileModal v-model:open="showIt" :user-id="id" @send-message="startChat" />
import { ref, watch } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatDate, timeAgo } from '@/utils/format'
import Avatar from './Avatar.vue'
import Modal from './Modal.vue'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  userId: { type: String, default: null },
})

const emit = defineEmits(['send-message'])

const auth = useAuthStore()
const toast = useToast()

const user = ref(null)
const activity = ref(null) // admins only

const COUNTS = [
  { key: 'messages', label: 'Messages', icon: '💬' },
  { key: 'posts', label: 'Posts', icon: '📝' },
  { key: 'comments', label: 'Comments', icon: '🗨️' },
  { key: 'reactions', label: 'Reactions', icon: '❤️' },
  { key: 'rooms', label: 'Rooms', icon: '🏠' },
  { key: 'channels', label: 'Channels', icon: '📢' },
]

watch(
  () => open.value && props.userId,
  async (userId) => {
    if (!userId) return
    user.value = null
    activity.value = null
    try {
      const [profile, stats] = await Promise.all([
        api.get(`/users/${userId}`),
        auth.isAdmin ? api.get(`/admin/users/${userId}/activity`) : null,
      ])
      user.value = profile.data
      activity.value = stats?.data || null
    } catch (error) {
      toast.error(errorMessage(error))
      open.value = false
    }
  },
  { immediate: true },
)

function sendMessage() {
  open.value = false
  emit('send-message', user.value)
}
</script>

<template>
  <Modal v-model:open="open" title="User profile" :size="auth.isAdmin ? 'lg' : 'md'">
    <p v-if="!user" class="text-muted">Loading…</p>

    <div v-else class="flex flex-col gap-5">
      <div class="flex items-center gap-4">
        <Avatar :user="user" size="xl" />
        <div class="min-w-0">
          <p class="truncate text-lg font-semibold text-fg">{{ user.displayName }}</p>
          <p class="truncate text-sm text-muted">@{{ user.username }}</p>
          <p class="mt-2 flex flex-wrap gap-1">
            <span v-if="user.online" class="badge badge-green">● Online</span>
            <span v-else class="badge badge-gray">○ Offline</span>
            <span v-if="user.role === 'admin'" class="badge badge-amber">Admin</span>
            <span v-if="user.status === 'disabled'" class="badge badge-red">Disabled</span>
          </p>
        </div>
      </div>

      <p v-if="user.bio" class="text-sm wrap-break-word whitespace-pre-line text-fg">{{ user.bio }}</p>
      <p v-else class="text-sm text-subtle italic">No bio yet</p>

      <dl class="divide-y divide-line border-y border-line text-sm">
        <div v-if="user.createdAt" class="flex justify-between gap-4 py-2">
          <dt class="text-muted">Member since</dt>
          <dd class="text-fg">{{ formatDate(user.createdAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4 py-2">
          <dt class="text-muted">Last login</dt>
          <dd class="text-fg">{{ user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never' }}</dd>
        </div>
      </dl>

      <!-- Admins only: what this user has been doing -->
      <section v-if="activity" aria-labelledby="profile-activity-title">
        <h3 id="profile-activity-title" class="mb-3 font-semibold text-fg">
          Activity <span class="badge ml-1 badge-amber">Admin view</span>
        </h3>
        <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div v-for="count in COUNTS" :key="count.key" class="glass-soft rounded-xl px-3 py-2">
            <p class="text-xs text-muted"><span aria-hidden="true">{{ count.icon }}</span> {{ count.label }}</p>
            <p class="text-xl font-bold text-fg tabular-nums">{{ activity.counts[count.key] }}</p>
          </div>
        </div>

        <p v-if="activity.recent.length === 0" class="text-sm text-muted">No activity yet.</p>
        <ul v-else class="max-h-64 divide-y divide-line overflow-y-auto">
          <li v-for="item in activity.recent" :key="item._id" class="flex items-center gap-3 py-2">
            <RouterLink v-if="item.link" :to="item.link" class="min-w-0 flex-1 truncate text-sm text-accent hover:underline">
              {{ item.summary }}
            </RouterLink>
            <span v-else class="min-w-0 flex-1 truncate text-sm">{{ item.summary }}</span>
            <span class="shrink-0 text-xs text-subtle">{{ timeAgo(item.createdAt) }}</span>
          </li>
        </ul>
      </section>

      <div v-if="user._id !== auth.user._id && user.status === 'active'" class="flex justify-end">
        <button type="button" class="btn btn-primary" @click="sendMessage">💬 Send message</button>
      </div>
    </div>
  </Modal>
</template>
