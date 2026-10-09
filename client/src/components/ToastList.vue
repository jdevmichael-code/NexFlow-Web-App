<script setup>
// Shows the toasts from useToast(): top-right under the nav bar on bigger screens (where the eye goes,
// and clear of the chat's Send button), at the bottom on phones.
// The list is a popover="manual" element so it is drawn in the browser's top layer,
// above any open <dialog>. Older browsers without popover support still see it
// thanks to the fixed positioning.
import { nextTick, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import Avatar from './Avatar.vue'

const { toasts, dismiss } = useToast()
const container = ref(null)

// Toasts look the same in both themes: solid dark cards with a colored stripe per kind.
// The stripe is extra: the icon and the words always say what kind of toast it is.
const STRIPES = {
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  error: 'bg-rose-500',
  notify: 'bg-linear-to-b from-cyan-400 to-violet-500',
  reminder: 'bg-amber-400',
}
const ICON_BACKGROUNDS = {
  info: 'bg-sky-400/15',
  success: 'bg-emerald-400/15',
  error: 'bg-rose-500/20',
  notify: 'bg-cyan-400/15',
  reminder: 'bg-amber-400/20',
}
const DEFAULT_ICONS = { success: '✅', error: '⚠️' }

// New messages and reminders are bigger and glow twice when they arrive
const isImportant = (toast) => toast.type === 'notify' || toast.type === 'reminder'

function runAction(toast) {
  dismiss(toast.id)
  toast.action.run()
}

// Watch the newest toast's id: it changes whenever a toast is added (or replaced by one with the same key)
watch(
  () => toasts.value.at(-1)?.id,
  async (newestId, oldNewestId) => {
    await nextTick()
    const el = container.value
    if (!el?.showPopover) return
    if (toasts.value.length === 0) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    // Re-show on every new toast so it moves above a dialog that opened later
    if (newestId > (oldNewestId ?? 0) && el.matches(':popover-open')) el.hidePopover()
    if (!el.matches(':popover-open')) el.showPopover()
  },
)
</script>

<template>
  <!-- Phones: bottom, newest at the bottom. Bigger screens: top-right, newest on top. -->
  <div
    ref="container"
    popover="manual"
    aria-live="polite"
    class="fixed inset-auto right-4 bottom-4 left-4 m-0 flex flex-col items-end gap-3 overflow-visible border-0 bg-transparent p-0 sm:top-18 sm:bottom-auto sm:left-auto sm:flex-col-reverse"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="status"
      class="relative flex w-full items-start gap-3 overflow-hidden rounded-2xl bg-slate-900/95 py-3 pr-2 pl-5 text-sm text-white shadow-2xl ring-1 ring-white/15"
      :class="isImportant(toast) ? 'max-w-md motion-safe:animate-toast-in-attention' : 'max-w-sm motion-safe:animate-toast-in'"
    >
      <span class="absolute inset-y-0 left-0 w-1.5" :class="STRIPES[toast.type]" aria-hidden="true" />

      <Avatar v-if="toast.user" :user="toast.user" />
      <span
        v-else-if="toast.icon || DEFAULT_ICONS[toast.type]"
        class="flex size-9 shrink-0 items-center justify-center rounded-full text-lg"
        :class="ICON_BACKGROUNDS[toast.type]"
        aria-hidden="true"
      >
        {{ toast.icon || DEFAULT_ICONS[toast.type] }}
      </span>

      <div class="min-w-0 flex-1 py-0.5">
        <p v-if="toast.title" class="font-semibold wrap-break-word">{{ toast.title }}</p>
        <p class="wrap-break-word" :class="toast.title ? 'mt-0.5 line-clamp-3 text-slate-300' : ''">{{ toast.message }}</p>

        <div v-if="toast.link || toast.action" class="mt-2.5 flex flex-wrap gap-2">
          <RouterLink
            v-if="toast.link"
            :to="toast.link"
            class="rounded-lg bg-linear-to-r from-blue-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            @click="dismiss(toast.id)"
          >
            {{ toast.linkLabel }}
          </RouterLink>
          <button
            v-if="toast.action"
            type="button"
            class="cursor-pointer rounded-lg bg-linear-to-r from-blue-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            @click="runAction(toast)"
          >
            {{ toast.action.label }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="shrink-0 cursor-pointer rounded-lg p-1.5 leading-none text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        aria-label="Dismiss"
        @click="dismiss(toast.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
