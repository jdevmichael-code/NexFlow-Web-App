<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatDate, formatPlanTime, timeAgo } from '@/utils/format'
import Avatar from '@/components/Avatar.vue'

const auth = useAuthStore()
const toast = useToast()

const data = ref(null)

const TILES = [
  { key: 'messages', label: 'Messages sent', icon: '💬' },
  { key: 'posts', label: 'Posts', icon: '📝' },
  { key: 'comments', label: 'Comments', icon: '🗨️' },
  { key: 'reactions', label: 'Reactions given', icon: '❤️' },
  { key: 'rooms', label: 'Rooms joined', icon: '🏠' },
  { key: 'channels', label: 'Channels joined', icon: '📢' },
  { key: 'upcomingPlans', label: 'Upcoming plans', icon: '📅' },
  { key: 'items', label: 'Inventory items', icon: '🗂️' },
]

const ACTION_ICONS = {
  sent_message: '💬',
  posted: '📝',
  commented: '🗨️',
  reacted: '❤️',
  created_room: '➕',
  created_channel: '➕',
  joined_room: '👋',
  joined_channel: '👋',
  created_plan: '📅',
  created_item: '🗂️',
}

const greeting = (() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})()

onMounted(async () => {
  try {
    const response = await api.get('/dashboard')
    data.value = response.data
  } catch (error) {
    toast.error(errorMessage(error))
  }
})
</script>

<template>
  <!-- Large screens: profile card on the left, dashboard on the right. Smaller screens: card on top. -->
  <div class="mx-auto grid w-full max-w-7xl items-start gap-6 p-4 sm:p-6 lg:grid-cols-[16rem_1fr]">
    <!-- ---------- Profile card ----------
         Phones/tablets: one compact row (picture, name, edit button).
         Large screens (lg:): a full card with banner, bio and account details. -->
    <aside class="card overflow-hidden lg:sticky lg:top-20" aria-label="Your profile">
      <div class="hidden h-16 bg-linear-to-r from-cyan-500 via-blue-600 to-violet-600 lg:block" />

      <div class="flex items-center gap-4 p-4 lg:-mt-10 lg:flex-col lg:gap-0 lg:px-5 lg:pt-0 lg:text-center">
        <div class="shrink-0 rounded-full lg:ring-4 lg:ring-base">
          <Avatar :user="auth.user" size="card" />
        </div>

        <div class="min-w-0 flex-1 lg:mt-3 lg:w-full">
          <p class="truncate font-semibold text-fg">{{ auth.user.displayName }}</p>
          <p class="truncate text-sm text-muted">
            @{{ auth.user.username }}
            <span v-if="auth.isAdmin" class="badge ml-1 badge-amber">Admin</span>
          </p>

          <div class="hidden lg:block">
            <p v-if="auth.user.bio" class="mt-3 line-clamp-4 text-sm wrap-break-word text-muted">{{ auth.user.bio }}</p>
            <p v-else class="mt-3 text-sm text-subtle italic">No bio yet</p>

            <dl class="mt-4 divide-y divide-line border-y border-line text-left text-xs">
              <div class="flex justify-between py-2">
                <dt class="text-muted">Member since</dt>
                <dd class="text-fg">{{ formatDate(auth.user.createdAt) }}</dd>
              </div>
              <div v-if="auth.user.lastLoginAt" class="flex justify-between py-2">
                <dt class="text-muted">Last login</dt>
                <dd class="text-fg">{{ timeAgo(auth.user.lastLoginAt) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <RouterLink to="/profile" class="btn btn-secondary btn-sm shrink-0 lg:mt-4 lg:w-full">Edit profile</RouterLink>
      </div>
    </aside>

    <!-- ---------- Dashboard ---------- -->
    <div class="min-w-0">
      <header class="mb-6">
        <h1 class="page-title">{{ greeting }}, {{ auth.user.displayName }} 👋</h1>
        <p class="text-sm text-muted">Here's what you've been up to on NexFlow.</p>
      </header>

      <p v-if="!data" class="text-muted">Loading…</p>

      <template v-else>
        <section class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Your stats">
          <div v-for="tile in TILES" :key="tile.key" class="card p-4">
            <p class="text-sm text-muted"><span aria-hidden="true">{{ tile.icon }}</span> {{ tile.label }}</p>
            <p class="mt-1 text-3xl font-bold text-fg tabular-nums">{{ data.counts[tile.key] }}</p>
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-3">
          <section class="card p-5 xl:col-span-2">
            <h2 class="mb-4 font-semibold text-fg">Recent activity</h2>
            <p v-if="data.recent.length === 0" class="text-sm text-muted">
              Nothing yet. Join a room or channel to get started!
            </p>
            <ul class="divide-y divide-line">
              <li v-for="activity in data.recent" :key="activity._id">
                <component
                  :is="activity.link ? RouterLink : 'div'"
                  :to="activity.link"
                  class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5"
                  :class="activity.link ? 'hover:bg-hover' : ''"
                >
                  <span class="text-lg" aria-hidden="true">{{ ACTION_ICONS[activity.action] || '•' }}</span>
                  <span class="min-w-0 flex-1 truncate text-sm">{{ activity.summary }}</span>
                  <span class="shrink-0 text-xs text-subtle">{{ timeAgo(activity.createdAt) }}</span>
                </component>
              </li>
            </ul>
          </section>

          <section class="card p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-semibold text-fg">Coming up</h2>
              <RouterLink to="/planner" class="text-sm text-accent hover:underline">Planner →</RouterLink>
            </div>
            <p v-if="data.upcomingPlans.length === 0" class="text-sm text-muted">No upcoming plans.</p>
            <ul class="flex flex-col gap-2">
              <li v-for="plan in data.upcomingPlans" :key="plan._id" class="rounded-lg bg-accent-soft px-3 py-2">
                <p class="truncate text-sm font-medium text-fg">{{ plan.title }}</p>
                <p class="text-xs text-accent">
                  {{ formatDate(plan.date + 'T00:00') }}<span v-if="plan.time"> · {{ formatPlanTime(plan.time) }}</span>
                </p>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>
