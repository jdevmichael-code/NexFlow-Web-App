import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// meta.guest: only for logged-out users (login, register)
// meta.admin: only for admins
// everything else: any logged-in user
const routes = [
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', component: () => import('@/views/RegisterView.vue'), meta: { guest: true } },

  { path: '/', component: () => import('@/views/DashboardView.vue') },
  { path: '/rooms', component: () => import('@/views/PlaceListView.vue'), props: { type: 'room' } },
  { path: '/rooms/:id', component: () => import('@/views/RoomChatView.vue'), props: true },
  { path: '/channels', component: () => import('@/views/PlaceListView.vue'), props: { type: 'channel' } },
  { path: '/channels/:id', component: () => import('@/views/ChannelView.vue'), props: true },
  { path: '/profile', component: () => import('@/views/ProfileView.vue') },
  { path: '/planner', component: () => import('@/views/PlannerView.vue') },
  { path: '/inventory', component: () => import('@/views/InventoryView.vue') },

  { path: '/admin/users', component: () => import('@/views/admin/AdminUsersView.vue'), meta: { admin: true } },
  {
    path: '/admin/rooms',
    component: () => import('@/views/admin/AdminPlacesView.vue'),
    props: { type: 'room' },
    meta: { admin: true },
  },
  {
    path: '/admin/channels',
    component: () => import('@/views/admin/AdminPlacesView.vue'),
    props: { type: 'channel' },
    meta: { admin: true },
  },
  { path: '/admin/private', component: () => import('@/views/admin/AdminPrivateView.vue'), meta: { admin: true } },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) await auth.loadSession()

  if (to.meta.guest) return auth.isLoggedIn ? '/' : true
  if (!auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.admin && !auth.isAdmin) return '/'
  return true
})

export default router
