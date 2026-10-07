<script setup>
// A round profile picture, or the user's initials on a colored circle.
import { computed } from 'vue'
import { fileUrl } from '@/utils/format'

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: String, default: 'md' }, // sm | md | lg | xl | card
})

const SIZES = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-24 text-3xl',
  card: 'size-14 text-xl lg:size-24 lg:text-3xl', // small on phones, big on large screens
}

const COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500']

const name = computed(() => props.user?.displayName || props.user?.username || '?')

const initials = computed(() =>
  name.value
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join(''),
)

// Same user → same color every time
const color = computed(() => {
  const text = props.user?.username || name.value
  const sum = [...text].reduce((total, char) => total + char.charCodeAt(0), 0)
  return COLORS[sum % COLORS.length]
})
</script>

<template>
  <img
    v-if="props.user?.avatar"
    :src="fileUrl(props.user.avatar)"
    :alt="name"
    class="shrink-0 rounded-full object-cover"
    :class="SIZES[props.size]"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    :class="[SIZES[props.size], color]"
    :aria-label="name"
  >
    {{ initials }}
  </span>
</template>
