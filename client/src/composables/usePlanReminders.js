import { onUnmounted, watch } from 'vue'
import { api } from '@/api/http'
import { socket } from '@/api/socket'
import { useAuthStore } from '@/stores/auth'
import { formatPlanTime, toDateKey } from '@/utils/format'
import { countUnseen, showDesktopNotification } from './useDesktopNotifications'
import { useToast } from './useToast'

/**
 * Planner reminders on every page (used once, in App.vue):
 * - after logging in: a summary of today's plans
 * - when a plan's time comes: a reminder that stays until it is dismissed
 * Reschedules when plans change (the server sends 'plans:changed'), after a reconnect, and at midnight.
 */
export function usePlanReminders() {
  const auth = useAuthStore()
  const toast = useToast()

  let timers = []
  let run = 0 // ignores an older schedule() that finishes after a newer one started

  function clearTimers() {
    timers.forEach(clearTimeout)
    timers = []
  }

  async function schedule({ summary = false } = {}) {
    const thisRun = ++run
    clearTimers()
    if (!auth.user) return

    const today = toDateKey(new Date())
    let plans
    try {
      ;({ data: plans } = await api.get('/plans', { params: { from: today, to: today } }))
    } catch {
      return // not important enough to show an error
    }
    if (thisRun !== run) return

    if (summary && plans.length) {
      const list = plans.map((plan) => (plan.time ? `${formatPlanTime(plan.time)} ${plan.title}` : plan.title))
      toast.info(list.join(' · '), 10000, { title: "Today's plans", icon: '📅', link: '/planner', linkLabel: 'Planner' })
    }

    const now = new Date()
    for (const plan of plans) {
      if (!plan.time) continue
      const [hours, minutes] = plan.time.split(':').map(Number)
      const at = new Date(now)
      at.setHours(hours, minutes, 0, 0)
      if (at > now) timers.push(setTimeout(() => remind(plan), at - now))
    }

    // Tomorrow's plans: schedule again just after midnight
    const midnight = new Date(now)
    midnight.setHours(24, 0, 5, 0)
    timers.push(setTimeout(() => schedule(), midnight - now))
  }

  function remind(plan) {
    const title = `⏰ Reminder: ${plan.title}`
    const body = `Now · ${formatPlanTime(plan.time)}${plan.note ? ` · ${plan.note}` : ''}`
    toast.reminder(body, { title, icon: '⏰', link: '/planner', linkLabel: 'Planner', key: `plan:${plan._id}` })
    countUnseen()
    showDesktopNotification({ title, body, link: '/planner', tag: `plan:${plan._id}`, sticky: true })
  }

  const reschedule = () => schedule()

  // Logged in (or switched user): summary + reminders. Logged out: nothing.
  watch(
    () => auth.user?._id,
    (userId, previousId) => {
      if (userId === previousId) return
      if (userId) schedule({ summary: true })
      else clearTimers()
    },
    { immediate: true },
  )
  socket.on('plans:changed', reschedule)
  socket.on('connect', reschedule) // plans may have changed while we were offline

  onUnmounted(() => {
    clearTimers()
    socket.off('plans:changed', reschedule)
    socket.off('connect', reschedule)
  })
}
