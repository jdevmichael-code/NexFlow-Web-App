import { computed, ref } from 'vue'
import router from '@/router'

// System ("desktop") notifications, shown by the operating system even when NexFlow is in a
// background tab or minimized. Plus an unread count in the tab title: "(3) NexFlow".
//
// Browsers only allow system notifications on secure pages: https:// or http://localhost.
// The user must also allow them once (the 🔔 button in the nav bar asks).

const SETTING_KEY = 'nexflow.desktopNotifications' // 'on' | 'off' (per browser)
const FOCUS_KEY = 'nexflow.focusedTab' // which NexFlow tab is in front, if any

export const desktopSupported = typeof Notification !== 'undefined' && window.isSecureContext

const permission = ref(desktopSupported ? Notification.permission : 'unsupported') // default | granted | denied
const enabled = ref(readStorage(SETTING_KEY) !== 'off')
const isOn = computed(() => desktopSupported && permission.value === 'granted' && enabled.value)

function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode etc.: the setting just isn't remembered
  }
}

// ---------- is anyone looking at NexFlow? ----------
// Each tab notes in localStorage when it is in front, so a background tab doesn't pop a
// system notification while the user is reading NexFlow in another tab.
const TAB_ID = Math.random().toString(36).slice(2)
const isInFront = () => document.visibilityState === 'visible' && document.hasFocus()

function trackFocus() {
  if (isInFront()) {
    writeStorage(FOCUS_KEY, TAB_ID)
    clearUnseen()
  } else if (readStorage(FOCUS_KEY) === TAB_ID) {
    writeStorage(FOCUS_KEY, null)
  }
}
window.addEventListener('focus', trackFocus)
window.addEventListener('blur', trackFocus)
document.addEventListener('visibilitychange', trackFocus)
window.addEventListener('pagehide', () => readStorage(FOCUS_KEY) === TAB_ID && writeStorage(FOCUS_KEY, null))

const someTabInFront = () => isInFront() || !!readStorage(FOCUS_KEY)

// ---------- "(3) NexFlow" in the tab title ----------
const baseTitle = document.title
let unseen = 0

function clearUnseen() {
  unseen = 0
  document.title = baseTitle
}

trackFocus()

/** Count something new in the tab title, if this tab isn't the one being looked at. */
export function countUnseen() {
  if (isInFront()) return
  unseen++
  document.title = `(${unseen}) ${baseTitle}`
}

/**
 * Show a system notification, but only when no NexFlow tab is in front (otherwise the in-app pop-up is enough).
 * tag: notifications with the same tag replace each other (e.g. one per chat room, also across tabs).
 * sticky: stays on screen until the user closes it (for reminders).
 * Returns true if it was shown.
 */
export function showDesktopNotification({ title, body, link, tag, sticky = false }) {
  if (!isOn.value || someTabInFront()) return false
  try {
    const notification = new Notification(title, { body, tag, requireInteraction: sticky })
    notification.onclick = () => {
      window.focus()
      if (link) router.push(link)
      notification.close()
    }
    return true
  } catch {
    return false // e.g. phones, where only installed apps may show notifications
  }
}

export function useDesktopNotifications() {
  /** Ask the browser for permission (must come from a click) and switch them on. Returns the permission. */
  async function turnOn() {
    if (!desktopSupported) return 'unsupported'
    if (permission.value !== 'granted') permission.value = await Notification.requestPermission()
    enabled.value = permission.value === 'granted'
    if (enabled.value) writeStorage(SETTING_KEY, 'on')
    return permission.value
  }

  function turnOff() {
    enabled.value = false
    writeStorage(SETTING_KEY, 'off')
  }

  return { supported: desktopSupported, permission, isOn, turnOn, turnOff }
}
