<script setup>
// Top bar of a room or channel page: name, privacy, members, and actions
// (join, leave, edit, clear, delete) depending on what the user is allowed to do.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import Icon from './Icon.vue'
import Modal from './Modal.vue'
import MemberManager from './MemberManager.vue'
import PlaceForm from './PlaceForm.vue'

const props = defineProps({
  type: { type: String, required: true }, // 'room' | 'channel'
  place: { type: Object, required: true },
})

const emit = defineEmits(['updated', 'joined'])
const router = useRouter()
const toast = useToast()

const showMembers = ref(false)
const showEdit = ref(false)
const url = `/${props.type}s/${props.place._id}`

async function run(action) {
  try {
    await action()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

const join = () =>
  run(async () => {
    const { data } = await api.post(`${url}/join`)
    emit('updated', data)
    emit('joined')
  })

const leave = () =>
  run(async () => {
    if (!confirm(`Leave "${props.place.name}"?`)) return
    await api.post(`${url}/leave`)
    toast.info(`You left "${props.place.name}"`)
    router.push(`/${props.type}s`)
  })

const clearContents = () =>
  run(async () => {
    const what = props.type === 'room' ? 'messages' : 'posts and comments'
    if (!confirm(`Delete ALL ${what} in "${props.place.name}"? This cannot be undone.`)) return
    await api.post(`${url}/clear`)
    toast.success('Contents cleared')
  })

const remove = () =>
  run(async () => {
    if (!confirm(`Delete "${props.place.name}" and everything in it? This cannot be undone.`)) return
    await api.delete(url)
    toast.success(`"${props.place.name}" was deleted`)
    router.push(`/${props.type}s`)
  })

async function saveEdit(form) {
  const { data } = await api.put(url, form)
  emit('updated', data)
  showEdit.value = false
}
</script>

<template>
  <header class="flex flex-wrap items-center gap-3 glass-bar border-b border-line px-4 py-3">
    <!-- On phones the title takes the full row and the buttons wrap below it -->
    <div class="min-w-0 flex-1 basis-full sm:basis-0">
      <h1 class="flex items-center gap-2 truncate text-lg font-semibold text-fg">
        <span aria-hidden="true">{{ props.type === 'room' ? '💬' : '📢' }}</span>
        <span class="truncate">{{ props.place.name }}</span>
        <span v-if="props.place.isPublic" class="badge badge-green">Public</span>
        <span v-else class="badge badge-gray">🔒 Private</span>
      </h1>
      <p class="truncate text-sm text-muted">
        {{ props.place.description || `Created by ${props.place.owner?.displayName}` }}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button v-if="props.place.canView" type="button" class="btn btn-secondary btn-sm" @click="showMembers = true">
        <Icon name="users" /> {{ props.place.memberCount }}
      </button>
      <button v-if="!props.place.isMember" type="button" class="btn btn-primary btn-sm" @click="join">Join</button>
      <button v-if="props.place.canManage" type="button" class="btn btn-secondary btn-sm" @click="showEdit = true">Edit</button>
      <button v-if="props.place.isMember && !props.place.isOwner" type="button" class="btn btn-secondary btn-sm" @click="leave">
        Leave
      </button>
      <button v-if="props.place.canManage" type="button" class="btn btn-secondary btn-sm text-warn" @click="clearContents">
        Clear
      </button>
      <button v-if="props.place.canManage" type="button" class="btn btn-danger btn-sm" @click="remove">Delete</button>
    </div>

    <Modal v-model:open="showMembers" title="Members">
      <MemberManager :type="props.type" :place="props.place" @updated="emit('updated', $event)" />
    </Modal>

    <Modal v-model:open="showEdit" :title="`Edit ${props.type}`">
      <PlaceForm :type="props.type" :initial="props.place" submit-label="Save" :submit="saveEdit" />
    </Modal>
  </header>
</template>
