<script setup>
// Share one of your inventory items in a chat room or channel you're a member of.
// Usage: <ShareItemModal v-model:open="showIt" :item="item" />
import { computed, ref, watch } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import Modal from './Modal.vue'
import SharedItem from './SharedItem.vue'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  item: { type: Object, default: null },
})

const toast = useToast()

const rooms = ref([])
const channels = ref([])
const loading = ref(false)
const target = ref('') // 'room:<id>' | 'channel:<id>'
const text = ref('')
const sending = ref(false)

const hasPlaces = computed(() => rooms.value.length + channels.value.length > 0)

// Load the places you can post in each time the pop-up opens
watch(open, async (isOpen) => {
  if (!isOpen) return
  target.value = ''
  text.value = ''
  loading.value = true
  try {
    const [roomList, channelList] = await Promise.all([api.get('/rooms'), api.get('/channels')])
    rooms.value = roomList.data.filter((place) => place.isMember)
    channels.value = channelList.data.filter((place) => place.isMember)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
})

async function share() {
  const [type, id] = target.value.split(':')
  const place = (type === 'room' ? rooms : channels).value.find((p) => p._id === id)
  const form = new FormData()
  form.append('text', text.value.trim())
  form.append('itemId', props.item._id)

  sending.value = true
  try {
    await api.post(type === 'room' ? `/rooms/${id}/messages` : `/channels/${id}/posts`, form)
    open.value = false
    toast.success(`Shared "${props.item.title}" in ${place.name}`, 6000, { link: `/${type}s/${id}` })
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Modal v-model:open="open" title="Share item">
    <form v-if="props.item" class="flex flex-col gap-4" @submit.prevent="share">
      <!-- What the others will see -->
      <SharedItem :item="props.item" :interactive="false" />

      <p v-if="loading" class="text-sm text-muted">Loading your rooms and channels…</p>
      <p v-else-if="!hasPlaces" class="rounded-lg bg-hover p-3 text-sm text-muted">
        Join a chat room or channel first, then you can share items there.
      </p>
      <template v-else>
        <div>
          <label class="label" for="share-target">Share in</label>
          <select id="share-target" v-model="target" class="input" required>
            <option value="" disabled>Choose a room or channel…</option>
            <optgroup v-if="rooms.length" label="💬 Chat rooms">
              <option v-for="room in rooms" :key="room._id" :value="`room:${room._id}`">{{ room.name }}</option>
            </optgroup>
            <optgroup v-if="channels.length" label="📢 Channels">
              <option v-for="channel in channels" :key="channel._id" :value="`channel:${channel._id}`">{{ channel.name }}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label class="label" for="share-text">Message <span class="font-normal text-subtle">(optional)</span></label>
          <textarea id="share-text" v-model="text" class="input" rows="2" maxlength="2000" placeholder="Say something about it…" />
        </div>
      </template>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary" @click="open = false">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="sending || !target">
          {{ sending ? 'Sharing…' : '↗ Share' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
