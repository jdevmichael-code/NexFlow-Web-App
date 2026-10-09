<script setup>
// An inventory item shared in a chat message or channel post.
// A small card; clicking it shows all the details (and the picture can be enlarged).
import { computed, ref } from 'vue'
import { fileUrl, formatDate } from '@/utils/format'
import { categoryOf } from '@/utils/items'
import Modal from './Modal.vue'
import PictureViewer from './PictureViewer.vue'

const props = defineProps({
  item: { type: Object, required: true }, // { title, category, whereToWatch, remarks, image } or { missing: true }
  interactive: { type: Boolean, default: true }, // false: just the card (the "share" preview)
})

const detailsOpen = ref(false)
const pictureOpen = ref(false)

const category = computed(() => categoryOf(props.item))
const picture = computed(() => (props.item.image ? fileUrl(props.item.image.path) : null))
const whereIsLink = computed(() => /^https?:\/\/\S+$/i.test(props.item.whereToWatch || ''))
</script>

<template>
  <!-- One root element, so a parent's class (e.g. mt-2) applies -->
  <div class="mt-1 w-72 max-w-full">
    <p v-if="props.item.missing" class="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
      🗂️ This shared item is no longer available
    </p>

    <template v-else>
      <component
        :is="props.interactive ? 'button' : 'div'"
        :type="props.interactive ? 'button' : undefined"
        class="glass-soft flex w-full items-center gap-3 rounded-xl p-2 text-left"
        :class="props.interactive ? 'cursor-pointer transition hover:shadow-[0_0_14px_var(--nx-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent' : ''"
        :aria-label="props.interactive ? `Shared ${category.label.toLowerCase()}: ${props.item.title}. View details` : undefined"
        @click="props.interactive && (detailsOpen = true)"
      >
        <img v-if="picture" :src="picture" alt="" loading="lazy" class="size-14 shrink-0 rounded-lg object-cover" />
        <span v-else class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-hover text-2xl" aria-hidden="true">
          {{ category.icon }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="badge badge-accent">{{ category.icon }} {{ category.label }}</span>
          <span class="mt-0.5 line-clamp-2 block text-sm font-semibold wrap-anywhere text-fg">{{ props.item.title }}</span>
          <span v-if="props.item.whereToWatch" class="block truncate text-xs text-muted">{{ props.item.whereToWatch }}</span>
        </span>
      </component>

      <Modal v-if="props.interactive" v-model:open="detailsOpen" :title="props.item.title">
        <div class="flex flex-col gap-3">
          <button
            v-if="picture"
            type="button"
            class="block cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            :aria-label="`Enlarge the picture of ${props.item.title}`"
            @click="pictureOpen = true"
          >
            <img :src="picture" :alt="props.item.title" class="max-h-72 w-full rounded-lg object-cover" />
          </button>

          <span class="badge self-start badge-accent">{{ category.icon }} {{ category.label }}</span>

          <dl class="flex flex-col gap-2 text-sm">
            <div v-if="props.item.whereToWatch">
              <dt class="text-muted">{{ category.whereLabel }}</dt>
              <dd class="wrap-anywhere text-fg">
                <a v-if="whereIsLink" :href="props.item.whereToWatch" target="_blank" rel="noopener noreferrer" class="text-accent underline">
                  {{ props.item.whereToWatch }}
                </a>
                <template v-else>{{ props.item.whereToWatch }}</template>
              </dd>
            </div>
            <div v-if="props.item.remarks">
              <dt class="text-muted">Remarks</dt>
              <!-- keep {{ }} on the same line as the tag: pre-wrap would show the extra spaces -->
              <dd class="wrap-anywhere whitespace-pre-wrap text-fg italic">"{{ props.item.remarks }}"</dd>
            </div>
            <div>
              <dt class="text-muted">Added to their inventory</dt>
              <dd class="text-fg">{{ formatDate(props.item.createdAt) }}</dd>
            </div>
          </dl>
        </div>
      </Modal>

      <PictureViewer v-if="picture" v-model:open="pictureOpen" :src="picture" :title="props.item.title" />
    </template>
  </div>
</template>
