<script setup>
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, onLoggedOut } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatPlanTime, toDateKey } from '@/utils/format'
import NavBar from '@/components/NavBar.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ToastList from '@/components/ToastList.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Any request that comes back 401 means our session ended
onLoggedOut(() => auth.clear())

// However we got logged out (Log out button, expired session, disabled by an admin),
// leave the page we were on and go to the login screen.
watch(
  () => auth.user,
  (user, previousUser) => {
    if (user || !previousUser || route.meta.guest) return
    toast.info('You have been logged out.')
    router.push('/login')
  },
)

// After logging in, pop up a reminder about today's plans
watch(
  () => auth.user?._id,
  async (userId, previousId) => {
    if (!userId || userId === previousId) return
    try {
      const today = toDateKey(new Date())
      const { data: plans } = await api.get('/plans', { params: { from: today, to: today } })
      if (plans.length === 0) return
      const list = plans.map((plan) => (plan.time ? `${formatPlanTime(plan.time)} ${plan.title}` : plan.title))
      toast.info(`📅 Today: ${list.join(' · ')}`, 8000)
    } catch {
      // not important enough to show an error
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <NavBar v-if="auth.user" />
    <!-- Logged-out pages have no nav bar, so the theme switch floats in the corner -->
    <div v-else class="fixed top-4 right-4 z-10"><ThemeToggle /></div>
    <main class="flex flex-1 flex-col">
      <!-- :key makes the page reload when only the :id changes (e.g. room A → room B).
           v-if hides logged-in pages the moment the session ends, before the redirect. -->
      <RouterView v-if="auth.user || route.meta.guest" :key="route.fullPath" />
    </main>
    <ToastList />
  </div>
</template>
