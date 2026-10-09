<script setup>
// A picture shown big in a pop-up (Esc, ✕ or a click outside closes it).
// Usage: <PictureViewer v-model:open="showIt" :src="fileUrl(path)" title="Beach trip" />
import Modal from './Modal.vue'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  src: { type: String, default: null },
  title: { type: String, default: '' }, // also the image's alt text
  size: { type: String, default: 'full' }, // Modal size: sm | md | lg | full
})
</script>

<template>
  <Modal v-model:open="open" :title="props.title" :size="props.size">
    <img v-if="props.src" :src="props.src" :alt="props.title" class="mx-auto max-h-[80vh] max-w-full rounded-lg object-contain" />
  </Modal>
</template>
