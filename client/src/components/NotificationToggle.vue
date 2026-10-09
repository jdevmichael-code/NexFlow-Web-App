<script setup>
// Bell button: turn desktop (system) notifications on or off.
// The first time on this browser it also offers to turn them on, since browsers
// only show the permission question after a click.
//
// Browsers only allow desktop notifications on https:// (or localhost). While NexFlow is served
// over plain http, the bell shows how to tell Chrome/Edge to treat NexFlow's address as secure.
import { computed, onMounted, ref } from 'vue'
import { useDesktopNotifications } from '@/composables/useDesktopNotifications'
import { useToast } from '@/composables/useToast'
import Modal from './Modal.vue'

const OFFERED_KEY = 'nexflow.desktopNotificationsOffered'
const SETUP_SEEN_KEY = 'nexflow.desktopNotificationsSetupSeen'

// The addresses people open NexFlow at. Update this list if the server's name or IP changes.
const NEXFLOW_ADDRESSES = ['http://hrdlt3066:4000', 'http://10.169.142.67:4000']
const CHROME_FLAG = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure'
const EDGE_FLAG = 'edge://flags/#unsafely-treat-insecure-origin-as-secure'

const { supported, permission, isOn, turnOn, turnOff } = useDesktopNotifications()
const toast = useToast()

const setupOpen = ref(false)
const setupSeen = ref(readStorage(SETUP_SEEN_KEY) === 'yes')

// Include the address this page was opened at, in case it isn't in the list yet
const addresses = computed(() => {
  const here = window.location.origin
  return (NEXFLOW_ADDRESSES.includes(here) || !here.startsWith('http:') ? NEXFLOW_ADDRESSES : [...NEXFLOW_ADDRESSES, here]).join(',')
})

// A dot on the bell until the user has decided (or, without https, has seen the setup steps)
const needsAttention = computed(() => (supported ? permission.value === 'default' : !setupSeen.value))
const label = computed(() => (isOn.value ? 'Desktop notifications are on (click to turn off)' : 'Turn on desktop notifications'))

function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode etc.: just not remembered
  }
}

function showSetup() {
  setupOpen.value = true
  setupSeen.value = true
  writeStorage(SETUP_SEEN_KEY, 'yes')
}

async function toggle() {
  if (!supported) return showSetup()

  if (isOn.value) {
    turnOff()
    toast.info('You will still see pop-ups inside NexFlow.', 5000, { title: 'Desktop notifications off', icon: '🔕' })
    return
  }

  const result = await turnOn()
  if (result === 'granted') {
    toast.success("You'll get new messages and reminders even when NexFlow is in the background.", 6000, {
      title: 'Desktop notifications on',
    })
    // A sample, so people see what they look like
    try {
      new Notification('NexFlow', { body: 'Desktop notifications are on 👍', tag: 'nexflow-test' })
    } catch {
      // not important
    }
  } else if (result === 'denied') {
    toast.error('Allow notifications for this site in your browser settings (the icon next to the address), then try again.', 12000, {
      title: 'Notifications are blocked',
    })
  }
}

/**
 * Copy text from one of the read-only boxes. Over plain http the modern clipboard API is
 * switched off by the browser, so fall back to selecting the text and the old copy command.
 */
async function copy(text, input) {
  try {
    await navigator.clipboard.writeText(text)
    return toast.success('Copied', 2000)
  } catch {
    input.focus()
    input.select()
    if (document.execCommand('copy')) return toast.success('Copied', 2000)
    toast.info('The text is selected: press Ctrl+C to copy it.', 5000)
  }
}

// Offer it once per browser
onMounted(() => {
  if (!needsAttention.value || readStorage(OFFERED_KEY)) return
  writeStorage(OFFERED_KEY, 'yes')
  toast.info('Get a desktop pop-up for new messages and planner reminders, even when NexFlow is in the background.', 20000, {
    title: 'Never miss a message',
    icon: '🔔',
    action: { label: supported ? 'Turn on' : 'Show me how', run: toggle },
  })
})
</script>

<template>
  <button
    type="button"
    class="btn btn-secondary relative size-9 rounded-full p-0"
    :class="isOn ? 'glass-selected' : ''"
    :aria-label="label"
    :aria-pressed="isOn"
    :title="label"
    @click="toggle"
  >
    <!-- Same bell both ways (🔕 looks like an error sign at this size): greyed out when off -->
    <span aria-hidden="true" :class="isOn ? '' : 'opacity-60 grayscale'">🔔</span>
    <!-- A dot until the user has decided -->
    <span v-if="needsAttention" class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warn ring-2 ring-base" aria-hidden="true" />
  </button>

  <!-- Without https: how to let Chrome (or Edge) show NexFlow's notifications -->
  <Modal v-model:open="setupOpen" title="Turn on desktop notifications">
    <div class="flex flex-col gap-4 text-sm">
      <p class="text-muted">
        Your browser only shows desktop notifications for secure (https) sites. NexFlow isn't on https yet, so tell
        Chrome that NexFlow's address is safe. It takes a minute and only affects NexFlow.
      </p>

      <ol class="flex flex-col gap-4">
        <li class="flex gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">1</span>
          <div class="min-w-0 flex-1">
            <p class="mb-1.5 text-fg">Open a new tab and enter this in Google Chrome's address bar:</p>
            <div class="flex gap-2">
              <textarea
                :value="CHROME_FLAG"
                readonly
                rows="1"
                class="input min-w-0 resize-none font-mono text-xs break-all field-sizing-content"
                aria-label="Chrome address to open"
                @focus="$event.target.select()"
              />
              <button type="button" class="btn btn-secondary shrink-0 self-start" @click="copy(CHROME_FLAG, $event.currentTarget.previousElementSibling)">Copy</button>
            </div>
          </div>
        </li>

        <li class="flex gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">2</span>
          <div class="min-w-0 flex-1">
            <p class="mb-1.5 text-fg">
              Under <b>"Insecure origins treated as secure"</b>, enter this in the text box:
            </p>
            <div class="flex gap-2">
              <textarea
                :value="addresses"
                readonly
                rows="1"
                class="input min-w-0 resize-none font-mono text-xs break-all field-sizing-content"
                aria-label="Addresses to enter"
                @focus="$event.target.select()"
              />
              <button type="button" class="btn btn-secondary shrink-0 self-start" @click="copy(addresses, $event.currentTarget.previousElementSibling)">Copy</button>
            </div>
          </div>
        </li>

        <li class="flex gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">3</span>
          <p class="min-w-0 flex-1 text-fg">
            Change <b>Disabled</b> to <b>Enabled</b>, then restart the browser (the <b>Relaunch</b> button at the bottom).
          </p>
        </li>

        <li class="flex gap-3">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">4</span>
          <p class="min-w-0 flex-1 text-fg">Come back to NexFlow and click the <span aria-hidden="true">🔔</span><span class="sr-only">bell button</span> again.</p>
        </li>
      </ol>

      <p class="rounded-lg bg-hover p-3 text-xs text-muted">
        Using Microsoft Edge? Same steps, but in step 1 enter <span class="font-mono break-all text-fg">{{ EDGE_FLAG }}</span>
      </p>

      <div class="flex justify-end">
        <button type="button" class="btn btn-primary" @click="setupOpen = false">Got it</button>
      </div>
    </div>
  </Modal>
</template>
