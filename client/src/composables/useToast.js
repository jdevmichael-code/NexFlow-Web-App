import { ref } from 'vue'

// Shared by the whole app: any component can show a toast, ToastList.vue displays them.
const toasts = ref([])
const timers = new Map() // toast id → its auto-close timer
let nextId = 1

const MAX_TOASTS = 5 // older ones are dropped, so the screen never fills up

export function useToast() {
  /**
   * type: info | success | error | notify (new message) | reminder (planner)
   * duration: ms before it closes by itself; 0 = stays until dismissed.
   * options.title: a bold first line (message is then the text under it)
   * options.user / options.icon: the sender's avatar, or an emoji, on the left
   * options.link / options.linkLabel: a button in the toast that opens a page.
   * options.action: { label, run } a button that runs a function (e.g. "Turn on")
   * options.key: a newer toast with the same key replaces the old one instead of stacking
   *   (e.g. one toast per chat room, however many messages arrive).
   */
  function show(message, type = 'info', duration = 4000, options = {}) {
    const { title = null, user = null, icon = null, link = null, linkLabel = 'Open', action = null, key = null } = options
    const old = key && toasts.value.find((toast) => toast.key === key)
    if (old) dismiss(old.id)

    const id = nextId++
    toasts.value.push({ id, message, type, title, user, icon, link, linkLabel, action, key })
    if (toasts.value.length > MAX_TOASTS) dismiss(toasts.value[0].id)
    if (duration) timers.set(id, setTimeout(() => dismiss(id), duration))
  }

  function dismiss(id) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts,
    dismiss,
    info: (message, duration, options) => show(message, 'info', duration, options),
    success: (message, duration, options) => show(message, 'success', duration, options),
    error: (message, duration = 6000, options) => show(message, 'error', duration, options),
    notify: (message, duration = 10000, options) => show(message, 'notify', duration, options),
    reminder: (message, options) => show(message, 'reminder', 0, options), // stays until dismissed
  }
}
