<script setup>
// Shows the toasts from useToast() in the bottom-right corner.
// The list is a popover="manual" element so it is drawn in the browser's top layer,
// above any open <dialog>. Older browsers without popover support still see it
// thanks to the fixed positioning.
import { nextTick, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
const container = ref(null)

const STYLES = {
  info: 'bg-slate-900 text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
}

watch(
  () => toasts.value.length,
  async (count, oldCount) => {
    await nextTick()
    const el = container.value
    if (!el?.showPopover) return
    if (count === 0) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    // Re-show on every new toast so it moves above a dialog that opened later
    if (count > oldCount && el.matches(':popover-open')) el.hidePopover()
    if (!el.matches(':popover-open')) el.showPopover()
  },
)
</script>

<template>
  <div
    ref="container"
    popover="manual"
    aria-live="polite"
    class="fixed inset-auto right-4 bottom-4 left-4 m-0 flex flex-col items-end gap-2 overflow-visible border-0 bg-transparent p-0 sm:left-auto"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="status"
      class="flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg"
      :class="STYLES[toast.type]"
    >
      <p class="flex-1 wrap-break-word">{{ toast.message }}</p>
      <button type="button" class="cursor-pointer opacity-70 hover:opacity-100" aria-label="Dismiss" @click="dismiss(toast.id)">
        ✕
      </button>
    </div>
  </div>
</template>
