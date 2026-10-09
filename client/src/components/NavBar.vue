<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Avatar from './Avatar.vue'
import NotificationToggle from './NotificationToggle.vue'
import ThemeToggle from './ThemeToggle.vue'

const auth = useAuthStore()
const route = useRoute()

const LINKS = [
    { to: '/', label: 'Dashboard', icon: '🏠' },
    { to: '/rooms', label: 'Chat rooms', icon: '💬' },
    { to: '/channels', label: 'Channels', icon: '📢' },
    { to: '/planner', label: 'Planner', icon: '📅' },
    { to: '/inventory', label: 'Inventory', icon: '🗂️' },
]

const ADMIN_LINKS = [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/rooms', label: 'Rooms' },
    { to: '/admin/channels', label: 'Channels' },
    { to: '/admin/private', label: 'Private chats' },
]

const menuOpen = ref(false) // mobile menu

// ---------- desktop admin dropdown ----------
// Closes when a link is clicked, on a click/tap outside it, on Esc, and after navigating.
const adminMenu = ref(null) // the <details> element

function closeAdminMenu() {
    if (adminMenu.value?.open) adminMenu.value.open = false
}

function onPointerDown(event) {
    if (!adminMenu.value?.contains(event.target)) closeAdminMenu()
}

function onKeydown(event) {
    if (event.key !== 'Escape') return
    // Keyboard users go back to the Admin button
    if (adminMenu.value?.contains(document.activeElement)) adminMenu.value.querySelector('summary').focus()
    closeAdminMenu()
}

// Only listen to the whole page while the menu is open
function stopListening() {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeydown)
}

function onAdminToggle() {
    stopListening()
    if (!adminMenu.value?.open) return
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
}

onUnmounted(stopListening)

// Close both menus after navigating
watch(
    () => route.fullPath,
    () => {
        menuOpen.value = false
        closeAdminMenu()
    },
)

/** Is this link the current page? '/rooms' is also active on '/rooms/123'. */
const isActive = (to) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

// App.vue sends us to the login page once the user is cleared
const logout = () => auth.logout()
</script>

<template>
    <nav class="glass-bar sticky top-0 z-10 border-b border-line">
        <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
            <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold text-accent">
                <span class="inline-flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-violet-600 text-white">N</span>
                NexFlow
            </RouterLink>

            <!-- Desktop links -->
            <div class="hidden flex-1 items-center gap-1 md:flex">
                <RouterLink
                    v-for="link in LINKS"
                    :key="link.to"
                    :to="link.to"
                    class="rounded-xl px-3 py-2 text-sm font-medium transition"
                    :class="isActive(link.to) ? 'glass-selected' : 'border border-transparent text-muted hover:text-fg'"
                    >
                    {{ link.label }}
                </RouterLink>

                <details v-if="auth.isAdmin" ref="adminMenu" class="relative" @toggle="onAdminToggle">
                    <summary
                        class="cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium"
                        :class="route.path.startsWith('/admin') ? 'glass-selected' : 'border border-transparent text-muted hover:text-fg'"
                        >
                        🛡️ Admin ▾
                    </summary>
                    <div class="glass absolute left-0 z-20 mt-2 w-40 rounded-xl py-1">
                        <RouterLink
                            v-for="link in ADMIN_LINKS"
                            :key="link.to"
                            :to="link.to"
                            class="block px-3 py-2 text-sm hover:bg-hover"
                            @click="closeAdminMenu"
                            >
                            {{ link.label }}
                        </RouterLink>
                    </div>
                </details>
            </div>

            <div class="ml-auto flex items-center gap-2">
                <NotificationToggle />
                <ThemeToggle />
                <RouterLink 
                    to="/profile" 
                    class="flex items-center gap-2 rounded-full p-0.5 pr-3 hover:bg-hover" 
                    title="Your profile"
                    >
                    <Avatar :user="auth.user" size="sm" />
                    <span class="hidden text-sm font-medium sm:inline">{{ auth.user.displayName }}</span>
                    <span v-if="auth.isAdmin" class="badge hidden badge-amber sm:inline-flex">Admin</span>
                </RouterLink>
                <button type="button" class="btn btn-ghost btn-sm hidden md:inline-flex" @click="logout">Log out</button>
                <button
                    type="button"
                    class="btn btn-ghost md:hidden"
                    :aria-expanded="menuOpen"
                    aria-label="Menu"
                    @click="menuOpen = !menuOpen"
                    >
                    ☰
                </button>
            </div>
        </div>

        <!-- Mobile menu -->
        <div v-if="menuOpen" class="border-t border-line px-4 py-2 md:hidden">
            <RouterLink
                v-for="link in LINKS"
                :key="link.to"
                :to="link.to"
                class="block rounded-xl px-3 py-2 text-sm font-medium"
                :class="isActive(link.to) ? 'glass-selected' : 'border border-transparent text-fg'"
                >
                {{ link.icon }} {{ link.label }}
            </RouterLink>
            <template v-if="auth.isAdmin">
                <p class="mt-2 px-3 text-xs font-semibold text-subtle uppercase">Admin</p>
                <RouterLink v-for="link in ADMIN_LINKS" :key="link.to" :to="link.to" class="block rounded-lg px-3 py-2 text-sm text-fg">
                🛡️ {{ link.label }}
                </RouterLink>
            </template>
            <button type="button" class="mt-2 block w-full rounded-lg px-3 py-2 text-left text-sm text-danger" @click="logout">
                Log out
            </button>
        </div>
    </nav>
</template>
