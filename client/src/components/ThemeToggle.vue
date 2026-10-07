<script setup>
// Sun/moon button that switches between dark and light mode.
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()
const label = computed(() => (theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'))
</script>

<template>
  <button type="button" class="btn btn-secondary size-9 rounded-full p-0" :aria-label="label" :title="label" @click="toggleTheme">
    <span aria-hidden="true">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
  </button>
</template>
