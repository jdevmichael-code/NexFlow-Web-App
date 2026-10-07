<script setup>
// Members list of a room/channel. The owner (and admins) can add people by
// searching their name, and remove members.
import { ref, watch } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import Avatar from './Avatar.vue'

const props = defineProps({
  type: { type: String, required: true }, // 'room' | 'channel'
  place: { type: Object, required: true }, // place details with members[]
})

const emit = defineEmits(['updated'])
const toast = useToast()

const query = ref('')
const results = ref([])
let searchTimer = null

// Wait until the user stops typing for a moment before searching
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (!q.trim()) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    const { data } = await api.get('/users/search', { params: { q } })
    const memberIds = props.place.members.map((member) => member._id)
    results.value = data.filter((user) => !memberIds.includes(user._id))
  }, 250)
})

async function addMember(user) {
  try {
    const { data } = await api.post(`/${props.type}s/${props.place._id}/members`, { userId: user._id })
    emit('updated', data)
    query.value = ''
    toast.success(`${user.displayName} was added`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function removeMember(user) {
  if (!confirm(`Remove ${user.displayName}?`)) return
  try {
    const { data } = await api.delete(`/${props.type}s/${props.place._id}/members/${user._id}`)
    emit('updated', data)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="props.place.canManage">
      <label class="label" for="member-search">Add people</label>
      <input id="member-search" v-model="query" class="input" placeholder="Search by name or username…" autocomplete="off" />
      <ul v-if="results.length" class="mt-2 divide-y divide-line rounded-lg border border-line">
        <li v-for="user in results" :key="user._id" class="flex items-center gap-3 px-3 py-2">
          <Avatar :user="user" size="sm" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="truncate font-medium">{{ user.displayName }}</p>
            <p class="truncate text-xs text-muted">@{{ user.username }}</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" @click="addMember(user)">Add</button>
        </li>
      </ul>
      <p v-else-if="query.trim()" class="mt-2 text-sm text-muted">No one found.</p>
    </div>

    <div>
      <h3 class="label">Members ({{ props.place.members.length }})</h3>
      <ul class="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        <li v-for="member in props.place.members" :key="member._id" class="flex items-center gap-3 px-3 py-2">
          <Avatar :user="member" size="sm" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="truncate font-medium">
              {{ member.displayName }}
              <span v-if="member._id === props.place.ownerId" class="badge badge-amber">Owner</span>
              <span v-if="member.role === 'admin'" class="badge badge-accent">Admin</span>
            </p>
            <p class="truncate text-xs text-muted">@{{ member.username }}</p>
          </div>
          <button
            v-if="props.place.canManage && member._id !== props.place.ownerId"
            type="button"
            class="btn btn-ghost btn-sm text-danger"
            @click="removeMember(member)"
          >
            Remove
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
