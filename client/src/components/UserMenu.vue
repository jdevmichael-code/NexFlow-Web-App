<script setup>
// The small menu for a person: "View user profile" or "Send message" (opens your private chat with them).
// Put one on a page and open it from any avatar or name:
//
//   <UserMenu ref="userMenu" />
//   <button @click="userMenu.open(user, $event.currentTarget)"><Avatar :user="user" /></button>
//
// It is a popover, so it lives in the top layer (scrolling lists can't clip it)
// and the browser closes it on Esc or a click outside.
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import UserProfileModal from './UserProfileModal.vue'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const menu = ref(null)
const menuUser = ref(null)
const startingChat = ref(false)
let menuTrigger = null
let closed = { userId: null, at: 0 } // the menu we closed last, and when

const isMe = computed(() => menuUser.value?._id === auth.user._id)

/** Open the menu for `user` next to the element that was clicked. */
async function open(user, trigger) {
  if (!user?._id) return // deleted users have no profile
  // Clicking the same person again closes the menu: the browser already closed it
  // (light dismiss) just before this click, so don't open it again
  if (closed.userId === user._id && Date.now() - closed.at < 300) return

  menuUser.value = user
  menuTrigger = trigger
  await nextTick()

  const el = menu.value
  if (!el.matches(':popover-open')) el.showPopover()

  // Below the person, or above when there is no room; always inside the screen
  const rect = trigger.getBoundingClientRect()
  const gap = 4
  const fitsBelow = rect.bottom + gap + el.offsetHeight <= window.innerHeight - 8
  const top = fitsBelow ? rect.bottom + gap : rect.top - gap - el.offsetHeight
  const left = Math.min(rect.left, window.innerWidth - el.offsetWidth - 8)
  Object.assign(el.style, { inset: 'auto', margin: '0', top: `${Math.max(8, top)}px`, left: `${Math.max(8, left)}px` })

  el.querySelector('button')?.focus({ preventScroll: true })
  window.addEventListener('scroll', close, { capture: true, passive: true })
  window.addEventListener('resize', close)
}

function close() {
  if (menu.value?.matches(':popover-open')) menu.value.hidePopover()
}

function stopWatchingScroll() {
  window.removeEventListener('scroll', close, { capture: true })
  window.removeEventListener('resize', close)
}

onUnmounted(stopWatchingScroll)

// beforetoggle (unlike toggle) fires right away, before the click that may follow
function onBeforeToggle(event) {
  if (event.newState !== 'closed') return
  closed = { userId: menuUser.value?._id, at: Date.now() }
  stopWatchingScroll()
  // Keyboard users go back to the person they opened the menu from
  if (menu.value.contains(document.activeElement) || document.activeElement === document.body) {
    menuTrigger?.focus({ preventScroll: true })
  }
  menuUser.value = null
}

// ---------- actions ----------

const profileOpen = ref(false)
const profileUserId = ref(null)

function viewProfile() {
  profileUserId.value = menuUser.value._id
  close()
  profileOpen.value = true
}

/** Go to the private chat with this user (the server creates it the first time). */
async function sendMessage(user) {
  close()
  if (startingChat.value) return
  startingChat.value = true
  try {
    const { data } = await api.post('/rooms/direct', { userId: user._id })
    router.push(`/rooms/${data._id}`)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    startingChat.value = false
  }
}

// openUserId: whose menu is open, for aria-expanded on the buttons that open it
defineExpose({ open, openUserId: computed(() => menuUser.value?._id ?? null) })
</script>

<template>
  <div ref="menu" popover="auto" class="glass w-52 rounded-xl p-1 text-fg" @beforetoggle="onBeforeToggle">
    <template v-if="menuUser">
      <p class="truncate px-3 pt-1.5 pb-1 text-xs text-muted">{{ isMe ? 'You' : menuUser.displayName }}</p>
      <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent" @click="viewProfile">
        <span aria-hidden="true">👤</span> View user profile
      </button>
      <button
        v-if="!isMe"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        :disabled="startingChat"
        @click="sendMessage(menuUser)"
      >
        <span aria-hidden="true">💬</span> Send message
      </button>
    </template>
  </div>

  <UserProfileModal v-model:open="profileOpen" :user-id="profileUserId" @send-message="sendMessage" />
</template>
