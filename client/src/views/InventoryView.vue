<script setup>
// Personal inventory: cards for places visited, movies watched, books read, etc.
import { computed, onMounted, reactive, ref } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { fileUrl, formatDate } from '@/utils/format'
import Modal from '@/components/Modal.vue'

const toast = useToast()

// Must match CATEGORIES in server/src/routes/items.js
const CATEGORIES = {
  place: { label: 'Place', icon: '📍', whereLabel: 'Location' },
  movie: { label: 'Movie', icon: '🎬', whereLabel: 'Where to watch' },
  series: { label: 'Series', icon: '📺', whereLabel: 'Where to watch' },
  book: { label: 'Book', icon: '📚', whereLabel: 'Where to get it' },
  game: { label: 'Game', icon: '🎮', whereLabel: 'Platform' },
  other: { label: 'Other', icon: '✨', whereLabel: 'Where' },
}

const items = ref([])
const loading = ref(true)
const filter = ref('all')
const search = ref('')

const visibleItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((item) => {
    if (filter.value !== 'all' && item.category !== filter.value) return false
    if (!q) return true
    return [item.title, item.whereToWatch, item.remarks].some((text) => text.toLowerCase().includes(q))
  })
})

const countFor = (category) => items.value.filter((item) => item.category === category).length

onMounted(async () => {
  try {
    const { data } = await api.get('/items')
    items.value = data
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
})

// ---------- create / edit pop-up ----------

const editorOpen = ref(false)
const saving = ref(false)
const form = reactive({ id: null, category: 'movie', title: '', whereToWatch: '', remarks: '' })
const imageFile = ref(null)
const imagePreview = ref(null)

function openEditor(item = null) {
  Object.assign(form, {
    id: item?._id || null,
    category: item?.category || (filter.value !== 'all' ? filter.value : 'movie'),
    title: item?.title || '',
    whereToWatch: item?.whereToWatch || '',
    remarks: item?.remarks || '',
  })
  setImage(null)
  imagePreview.value = item?.image ? fileUrl(item.image.path) : null
  editorOpen.value = true
}

function setImage(file) {
  if (imagePreview.value?.startsWith('blob:')) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = file
  imagePreview.value = file ? URL.createObjectURL(file) : null
}

function pickImage(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) return toast.error('Image is too big (max 10 MB)')
  setImage(file)
}

async function saveItem() {
  saving.value = true
  const body = new FormData()
  for (const field of ['category', 'title', 'whereToWatch', 'remarks']) body.append(field, form[field])
  if (imageFile.value) body.append('image', imageFile.value)

  try {
    if (form.id) {
      const { data } = await api.put(`/items/${form.id}`, body)
      items.value = items.value.map((item) => (item._id === data._id ? data : item))
      toast.success('Item updated')
    } else {
      const { data } = await api.post('/items', body)
      items.value.unshift(data)
      toast.success(`Added "${data.title}"`)
    }
    editorOpen.value = false
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deleteItem(item) {
  if (!confirm(`Delete "${item.title}"?`)) return
  try {
    await api.delete(`/items/${item._id}`)
    items.value = items.value.filter((i) => i._id !== item._id)
    editorOpen.value = false
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">🗂️ Inventory</h1>
        <p class="text-sm text-muted">Places you visited, movies you watched, books you read…</p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <input v-model="search" class="input sm:w-56" placeholder="Search…" aria-label="Search inventory" />
        <button type="button" class="btn btn-primary" @click="openEditor()">+ New item</button>
      </div>
    </header>

    <div class="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      <button
        type="button"
        class="badge cursor-pointer px-3 py-1 text-sm"
        :class="filter === 'all' ? 'glass-selected' : 'glass-soft text-muted hover:text-fg'"
        :aria-pressed="filter === 'all'"
        @click="filter = 'all'"
      >
        All {{ items.length }}
      </button>
      <button
        v-for="(category, key) in CATEGORIES"
        :key="key"
        type="button"
        class="badge cursor-pointer px-3 py-1 text-sm"
        :class="filter === key ? 'glass-selected' : 'glass-soft text-muted hover:text-fg'"
        :aria-pressed="filter === key"
        @click="filter = key"
      >
        {{ category.icon }} {{ category.label }} {{ countFor(key) }}
      </button>
    </div>

    <p v-if="loading" class="text-muted">Loading…</p>

    <div v-else-if="visibleItems.length === 0" class="card p-10 text-center">
      <p class="text-4xl">🗂️</p>
      <p class="mt-2 font-medium">{{ items.length ? 'Nothing matches your filter.' : 'Your inventory is empty.' }}</p>
      <button v-if="!items.length" type="button" class="btn btn-primary mt-4" @click="openEditor()">Add your first item</button>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button
        v-for="item in visibleItems"
        :key="item._id"
        type="button"
        class="card flex cursor-pointer flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:ring-1 hover:ring-indigo-400/40"
        @click="openEditor(item)"
      >
        <img v-if="item.image" :src="fileUrl(item.image.path)" :alt="item.title" loading="lazy" class="h-40 w-full object-cover" />
        <div v-else class="flex h-24 items-center justify-center bg-hover text-4xl" aria-hidden="true">
          {{ CATEGORIES[item.category].icon }}
        </div>

        <div class="flex flex-1 flex-col gap-1 p-4">
          <span class="badge self-start badge-accent">
            {{ CATEGORIES[item.category].icon }} {{ CATEGORIES[item.category].label }}
          </span>
          <h2 class="mt-1 font-semibold wrap-break-word text-fg">{{ item.title }}</h2>
          <p v-if="item.whereToWatch" class="text-sm text-muted">
            <span class="text-subtle">{{ CATEGORIES[item.category].whereLabel }}:</span> {{ item.whereToWatch }}
          </p>
          <p v-if="item.remarks" class="line-clamp-3 text-sm text-muted italic">"{{ item.remarks }}"</p>
          <p class="mt-auto pt-2 text-xs text-subtle">Added {{ formatDate(item.createdAt) }}</p>
        </div>
      </button>
    </div>

    <Modal v-model:open="editorOpen" :title="form.id ? 'Edit item' : 'New item'">
      <form class="flex flex-col gap-4" @submit.prevent="saveItem">
        <div>
          <label class="label" for="item-category">Category</label>
          <select id="item-category" v-model="form.category" class="input">
            <option v-for="(category, key) in CATEGORIES" :key="key" :value="key">{{ category.icon }} {{ category.label }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="item-title">Title</label>
          <input id="item-title" v-model="form.title" class="input" maxlength="100" required />
        </div>
        <div>
          <label class="label" for="item-where">{{ CATEGORIES[form.category].whereLabel }}</label>
          <input id="item-where" v-model="form.whereToWatch" class="input" maxlength="200" />
        </div>
        <div>
          <label class="label" for="item-remarks">Remarks</label>
          <textarea id="item-remarks" v-model="form.remarks" class="input" rows="3" maxlength="2000" placeholder="What did you think?" />
        </div>
        <div>
          <span class="label">Picture <span class="font-normal text-subtle">(optional)</span></span>
          <div class="flex items-center gap-3">
            <img v-if="imagePreview" :src="imagePreview" alt="Selected picture" class="size-16 rounded-lg object-cover" />
            <label class="btn btn-secondary">
              {{ imagePreview ? 'Change picture' : 'Choose picture' }}
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="sr-only" @change="pickImage" />
            </label>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2">
          <button v-if="form.id" type="button" class="btn btn-ghost text-danger" @click="deleteItem(items.find((i) => i._id === form.id))">
            Delete
          </button>
          <span v-else />
          <button type="submit" class="btn btn-primary" :disabled="saving || !form.title.trim()">
            {{ saving ? 'Saving…' : form.id ? 'Save changes' : 'Add item' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
