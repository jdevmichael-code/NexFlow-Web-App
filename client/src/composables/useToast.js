import { ref } from 'vue'

// Shared by the whole app: any component can show a toast, ToastList.vue displays them.
const toasts = ref([])
let nextId = 1

export function useToast() {
  function show(message, type = 'info', duration = 4000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    if (duration) setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts,
    dismiss,
    info: (message, duration) => show(message, 'info', duration),
    success: (message, duration) => show(message, 'success', duration),
    error: (message, duration = 6000) => show(message, 'error', duration),
  }
}
