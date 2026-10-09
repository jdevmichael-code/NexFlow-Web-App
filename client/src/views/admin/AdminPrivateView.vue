<script setup>
// Admin: every private room and channel in one place (including private chats made with "Send message"),
// with who is in each one.
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import Avatar from '@/components/Avatar.vue'

const toast = useToast()
const places = ref([])
const loading = ref(true)
const search = ref('')
const filter = ref('all')

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'direct', label: 'Private chats' },
  { key: 'room', label: 'Rooms' },
  { key: 'channel', label: 'Channels' },
]

const MAX_AVATARS = 4

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return places.value.filter((place) => {
    if (filter.value === 'direct' && !place.isDirect) return false
    if ((filter.value === 'room' || filter.value === 'channel') && place.type !== filter.value) return false
    if (!q) return true
    return (
      place.name.toLowerCase().includes(q) ||
      place.members.some((user) => user.displayName.toLowerCase().includes(q) || user.username.includes(q))
    )
  })
})

const contentName = (place) => (place.type === 'room' ? 'messages' : 'posts and comments')

onMounted(async () => {
  try {
    const { data } = await api.get('/admin/private-places')
    places.value = data
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
})

async function deletePlace(place) {
  if (!confirm(`Delete "${place.name}" and all of its ${contentName(place)}? This cannot be undone.`)) return
  try {
    await api.delete(`/${place.type}s/${place._id}`)
    places.value = places.value.filter((p) => p._id !== place._id)
    toast.success(`"${place.name}" was deleted`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl p-4 sm:p-6">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">🛡️ Private rooms &amp; channels</h1>
        <p class="text-sm text-muted">{{ places.length }} private, including private chats between users</p>
      </div>
      <input v-model="search" class="input sm:w-72" placeholder="Search name or member…" aria-label="Search" />
    </header>

    <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show">
      <button
        v-for="option in FILTERS"
        :key="option.key"
        type="button"
        class="rounded-xl px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
        :class="filter === option.key ? 'glass-selected' : 'glass-soft text-muted hover:text-fg'"
        :aria-pressed="filter === option.key"
        @click="filter = option.key"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- A table on large screens. Smaller screens: each row becomes a stacked card, so nothing scrolls sideways. -->
    <div class="card overflow-hidden lg:overflow-x-auto">
      <table class="block w-full text-left text-sm lg:table lg:min-w-3xl">
        <thead class="hidden border-b border-line bg-hover text-xs text-muted uppercase lg:table-header-group">
          <tr>
            <th class="px-4 py-3 font-semibold">Name</th>
            <th class="px-4 py-3 font-semibold">Type</th>
            <th class="px-4 py-3 font-semibold">Members</th>
            <th class="px-4 py-3 font-semibold">Owner</th>
            <th class="px-4 py-3 font-semibold">Created</th>
            <th class="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody class="block divide-y divide-line lg:table-row-group">
          <tr v-if="loading" class="block lg:table-row">
            <td colspan="6" class="block px-4 py-8 text-center text-muted lg:table-cell">Loading…</td>
          </tr>
          <tr v-for="place in filtered" :key="place._id" class="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 lg:table-row lg:p-0">
            <td class="w-full min-w-0 lg:w-auto lg:px-4 lg:py-3">
              <p class="font-medium wrap-break-word text-fg">{{ place.name }}</p>
              <p class="truncate text-xs text-muted lg:max-w-xs">{{ place.description }}</p>
            </td>
            <td class="lg:px-4 lg:py-3">
              <span v-if="place.isDirect" class="badge badge-accent">💬 Private chat</span>
              <span v-else-if="place.type === 'room'" class="badge badge-gray">🔒 Room</span>
              <span v-else class="badge badge-gray">🔒 Channel</span>
            </td>
            <td class="w-full min-w-0 lg:w-auto lg:px-4 lg:py-3">
              <div class="flex items-center gap-2">
                <div class="flex shrink-0 -space-x-2" aria-hidden="true">
                  <Avatar v-for="user in place.members.slice(0, MAX_AVATARS)" :key="user._id" :user="user" size="sm" class="ring-2 ring-base" />
                </div>
                <p class="min-w-0 truncate text-muted lg:max-w-56" :title="place.members.map((user) => user.displayName).join(', ')">
                  {{ place.members.map((user) => user.displayName).join(', ') }}
                </p>
              </div>
            </td>
            <td class="min-w-0 text-xs wrap-break-word text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Owner: </span>{{ place.owner.displayName }}
            </td>
            <td class="text-xs text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Created </span>{{ formatDate(place.createdAt) }}
            </td>
            <td class="w-full lg:w-auto lg:px-4 lg:py-3">
              <div class="-ml-2.5 flex flex-wrap gap-1 lg:ml-0 lg:flex-nowrap lg:justify-end">
                <RouterLink :to="`/${place.type}s/${place._id}`" class="btn btn-ghost btn-sm">Open</RouterLink>
                <button type="button" class="btn btn-ghost btn-sm text-danger" @click="deletePlace(place)">Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && filtered.length === 0" class="block lg:table-row">
            <td colspan="6" class="block px-4 py-8 text-center text-muted lg:table-cell">Nothing found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
