<script setup>
// Shows an attached image.
// Small images (≤ 1 MB) show right away. Large ones show a placeholder
// with a "Show" button, so they only download when the user wants them.
// Clicking a shown image opens it full size.
import { ref } from 'vue'
import Modal from './Modal.vue'
import { fileUrl, formatSize } from '@/utils/format'

const props = defineProps({
  image: { type: Object, required: true }, // { path, name, size, isLarge }
})

const shown = ref(!props.image.isLarge)
const fullSize = ref(false)
</script>

<template>
  <div class="mt-1">
    <div
      v-if="!shown"
      class="flex max-w-xs items-center gap-3 rounded-lg border border-dashed border-line bg-hover px-3 py-2"
    >
      <span class="text-2xl" aria-hidden="true">🖼️</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-fg">{{ props.image.name }}</p>
        <p class="text-xs text-muted">Large image · {{ formatSize(props.image.size) }}</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" @click="shown = true">Show</button>
    </div>

    <button v-else type="button" class="block cursor-zoom-in" :aria-label="`Open ${props.image.name}`" @click="fullSize = true">
      <img
        :src="fileUrl(props.image.path)"
        :alt="props.image.name"
        loading="lazy"
        class="max-h-64 max-w-full rounded-lg border border-line object-contain"
      />
    </button>

    <Modal v-model:open="fullSize" :title="props.image.name" size="full">
      <img :src="fileUrl(props.image.path)" :alt="props.image.name" class="mx-auto max-h-[80vh] max-w-full object-contain" />
    </Modal>
  </div>
</template>
