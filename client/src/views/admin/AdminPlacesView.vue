<script setup>
// Admin: a table of all rooms or channels (public and private), with open / clear / delete.
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'

const props = defineProps({
  type: { type: String, required: true }, // 'room' | 'channel'
})

const toast = useToast()
const places = ref([])
const loading = ref(true)
const search = ref('')

const title = props.type === 'room' ? 'Chat rooms' : 'Channels'
const contentName = props.type === 'room' ? 'messages' : 'posts and comments'

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return places.value
  return places.value.filter((place) => place.name.toLowerCase().includes(q) || place.owner.displayName.toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    const { data } = await api.get(`/${props.type}s`)
    places.value = data
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
})

async function clearContents(place) {
  if (!confirm(`Delete ALL ${contentName} in "${place.name}"? The ${props.type} itself stays. This cannot be undone.`)) return
  try {
    await api.post(`/${props.type}s/${place._id}/clear`)
    toast.success(`"${place.name}" was cleared`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function deletePlace(place) {
  if (!confirm(`Delete "${place.name}" and all of its ${contentName}? This cannot be undone.`)) return
  try {
    await api.delete(`/${props.type}s/${place._id}`)
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
        <h1 class="page-title">🛡️ {{ title }}</h1>
        <p class="text-sm text-muted">{{ places.length }} total, including private ones</p>
      </div>
      <input v-model="search" class="input sm:w-72" placeholder="Search name or owner…" aria-label="Search" />
    </header>

    <!-- A table on large screens. Smaller screens: each row becomes a stacked card, so nothing scrolls sideways. -->
    <div class="card overflow-hidden lg:overflow-x-auto">
      <table class="block w-full text-left text-sm lg:table lg:min-w-3xl">
        <thead class="hidden border-b border-line bg-hover text-xs text-muted uppercase lg:table-header-group">
          <tr>
            <th class="px-4 py-3 font-semibold">Name</th>
            <th class="px-4 py-3 font-semibold">Owner</th>
            <th class="px-4 py-3 font-semibold">Visibility</th>
            <th class="px-4 py-3 font-semibold">Members</th>
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
            <td class="min-w-0 text-xs wrap-break-word text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Owner: </span>{{ place.owner.displayName }}
            </td>
            <td class="lg:px-4 lg:py-3">
              <span v-if="place.isPublic" class="badge badge-green">Public</span>
              <span v-else class="badge badge-gray">🔒 Private</span>
            </td>
            <td class="text-xs text-muted tabular-nums lg:px-4 lg:py-3 lg:text-sm">
              {{ place.memberCount }}<span class="lg:hidden"> members</span>
            </td>
            <td class="text-xs text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Created </span>{{ formatDate(place.createdAt) }}
            </td>
            <td class="w-full lg:w-auto lg:px-4 lg:py-3">
              <div class="-ml-2.5 flex flex-wrap gap-1 lg:ml-0 lg:flex-nowrap lg:justify-end">
                <RouterLink :to="`/${props.type}s/${place._id}`" class="btn btn-ghost btn-sm">Open</RouterLink>
                <button type="button" class="btn btn-ghost btn-sm text-warn" @click="clearContents(place)">Clear</button>
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
