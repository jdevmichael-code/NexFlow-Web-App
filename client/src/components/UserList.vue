<script setup>
// Who's online / offline. Clicking a person opens the UserMenu:
// "View user profile" or "Send message" (opens your private chat with them).
import { onMounted, onUnmounted, ref } from 'vue'
import { api, errorMessage } from '@/api/http'
import { socket } from '@/api/socket'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { timeAgo } from '@/utils/format'
import Avatar from './Avatar.vue'
import UserMenu from './UserMenu.vue'

const auth = useAuthStore()
const toast = useToast()

const online = ref([])
const offline = ref([])
const nextSkip = ref(null) // more offline users to load?
const loading = ref(true)
const loadingMore = ref(false)

const byName = (a, b) => a.displayName.localeCompare(b.displayName)

// ---------- loading ----------

async function load() {
  try {
    const { data } = await api.get('/users/presence')
    online.value = data.online
    offline.value = data.offline
    nextSkip.value = data.nextSkip
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const { data } = await api.get('/users/presence', { params: { skip: nextSkip.value } })
    const known = new Set([...online.value, ...offline.value].map((user) => user._id))
    online.value = data.online
    offline.value.push(...data.offline.filter((user) => !known.has(user._id)))
    nextSkip.value = data.nextSkip
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loadingMore.value = false
  }
}

/** Someone came online or went offline: move them between the two lists. */
async function onPresence({ userId, online: isOnline }) {
  if (userId === auth.user._id) return
  const from = isOnline ? offline : online
  const index = from.value.findIndex((user) => user._id === userId)
  let user = index >= 0 ? from.value.splice(index, 1)[0] : null

  if (!isOnline) {
    if (user) offline.value.unshift(user)
    return
  }

  // A user we haven't loaded yet (e.g. on a later page): fetch them
  if (!user) {
    try {
      const { data } = await api.get(`/users/${userId}`)
      if (data.status !== 'active') return
      user = data
    } catch {
      return
    }
  }
  if (!online.value.some((u) => u._id === userId)) online.value = [...online.value, user].sort(byName)
}

onMounted(() => {
  load()
  socket.on('presence:changed', onPresence)
  socket.on('connect', load) // after a reconnect our lists may be out of date
})

onUnmounted(() => {
  socket.off('presence:changed', onPresence)
  socket.off('connect', load)
})

// One menu for every person in the list (View user profile / Send message)
const userMenu = ref(null)
</script>

<template>
  <section class="card flex min-h-0 flex-col p-4" aria-labelledby="people-title">
    <h2 id="people-title" class="mb-3 shrink-0 font-semibold text-fg">People</h2>

    <p v-if="loading" class="text-sm text-muted">Loading…</p>

    <!-- Scrolls on its own: a fixed height on phones, the rest of the screen on large screens -->
    <div v-else class="-mx-2 max-h-64 min-h-0 overflow-y-auto sm:max-h-80 lg:max-h-none">
      <h3 class="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">Online — {{ online.length }}</h3>
      <p v-if="online.length === 0" class="mb-3 px-2 text-sm text-subtle">Nobody else is online.</p>
      <ul class="mb-4">
        <li v-for="user in online" :key="user._id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            :aria-expanded="userMenu?.openUserId === user._id"
            @click="userMenu.open(user, $event.currentTarget)"
          >
            <span class="relative shrink-0">
              <Avatar :user="user" size="sm" />
              <span class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-base" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-fg">{{ user.displayName }}</span>
              <span class="block truncate text-xs text-muted">@{{ user.username }} · online</span>
            </span>
          </button>
        </li>
      </ul>

      <h3 class="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">Offline</h3>
      <p v-if="offline.length === 0 && nextSkip === null" class="px-2 text-sm text-subtle">Nobody else here.</p>
      <ul>
        <li v-for="user in offline" :key="user._id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            :aria-expanded="userMenu?.openUserId === user._id"
            @click="userMenu.open(user, $event.currentTarget)"
          >
            <span class="shrink-0 opacity-60"><Avatar :user="user" size="sm" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-muted">{{ user.displayName }}</span>
              <span class="block truncate text-xs text-subtle">
                {{ user.lastLoginAt ? `Last login ${timeAgo(user.lastLoginAt)}` : `@${user.username}` }}
              </span>
            </span>
          </button>
        </li>
      </ul>
      <button
        v-if="nextSkip !== null"
        type="button"
        class="btn btn-ghost btn-sm mt-2 w-full"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? 'Loading…' : 'Show more' }}
      </button>
    </div>

    <UserMenu ref="userMenu" />
  </section>
</template>
