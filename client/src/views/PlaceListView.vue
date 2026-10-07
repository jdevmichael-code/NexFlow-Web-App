<script setup>
// The list of chat rooms or channels (the router passes type = 'room' | 'channel').
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import PlaceForm from '@/components/PlaceForm.vue'

const props = defineProps({
  type: { type: String, required: true },
})

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const places = ref([])
const loading = ref(true)
const search = ref('')
const showCreate = ref(false)

const TEXT = {
  room: { title: 'Chat rooms', icon: '💬', intro: 'Talk live with other people.', create: 'New room' },
  channel: { title: 'Channels', icon: '📢', intro: 'Share posts, react and comment.', create: 'New channel' },
}
const text = TEXT[props.type]

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return places.value
  return places.value.filter((place) => place.name.toLowerCase().includes(q) || place.description.toLowerCase().includes(q))
})
const mine = computed(() => filtered.value.filter((place) => place.isMember))
const others = computed(() => filtered.value.filter((place) => !place.isMember))

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

async function create(form) {
  const { data } = await api.post(`/${props.type}s`, form)
  showCreate.value = false
  router.push(`/${props.type}s/${data._id}`)
}

async function join(place) {
  try {
    await api.post(`/${props.type}s/${place._id}/join`)
    router.push(`/${props.type}s/${place._id}`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl p-4 sm:p-6">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="page-title">{{ text.icon }} {{ text.title }}</h1>
        <p class="text-sm text-muted">{{ text.intro }}</p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <input v-model="search" class="input sm:w-56" placeholder="Search…" aria-label="Search" />
        <button type="button" class="btn btn-primary" @click="showCreate = true">+ {{ text.create }}</button>
      </div>
    </header>

    <p v-if="loading" class="text-muted">Loading…</p>

    <template v-else>
      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Yours</h2>
        <p v-if="mine.length === 0" class="card p-6 text-center text-sm text-muted">
          You haven't joined any {{ props.type }}s yet. Create one or join one below.
        </p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="place in mine"
            :key="place._id"
            :to="`/${props.type}s/${place._id}`"
            class="card block p-4 transition hover:-translate-y-0.5 hover:ring-1 hover:ring-indigo-400/40"
          >
            <div class="flex items-center justify-between gap-2">
              <h3 class="truncate font-semibold text-fg">{{ place.name }}</h3>
              <span v-if="!place.isPublic" class="badge badge-gray">🔒</span>
            </div>
            <p class="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{{ place.description || 'No description' }}</p>
            <p class="mt-3 flex items-center gap-1 text-xs text-subtle">
              <Icon name="users" /> {{ place.memberCount }} · {{ place.isOwner ? 'You own this' : `by ${place.owner.displayName}` }}
            </p>
          </RouterLink>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
          {{ auth.isAdmin ? 'All others (admin view)' : 'Discover' }}
        </h2>
        <p v-if="others.length === 0" class="text-sm text-muted">Nothing new to join right now.</p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="place in others" :key="place._id" class="card flex flex-col p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="truncate font-semibold text-fg">{{ place.name }}</h3>
              <span v-if="!place.isPublic" class="badge badge-gray">🔒 Private</span>
            </div>
            <p class="mt-1 line-clamp-2 min-h-10 flex-1 text-sm text-muted">{{ place.description || 'No description' }}</p>
            <div class="mt-3 flex items-center justify-between">
              <span class="flex items-center gap-1 text-xs text-subtle">
                <Icon name="users" /> {{ place.memberCount }} · by {{ place.owner.displayName }}
              </span>
              <div class="flex gap-1">
                <RouterLink v-if="auth.isAdmin" :to="`/${props.type}s/${place._id}`" class="btn btn-secondary btn-sm">View</RouterLink>
                <button type="button" class="btn btn-primary btn-sm" @click="join(place)">Join</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Modal v-model:open="showCreate" :title="text.create">
      <PlaceForm :type="props.type" :submit="create" />
    </Modal>
  </div>
</template>
