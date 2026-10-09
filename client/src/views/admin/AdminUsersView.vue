<script setup>
// Admin: manage all user accounts.
import { computed, onMounted, ref, watch } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatDate, timeAgo } from '@/utils/format'
import Avatar from '@/components/Avatar.vue'
import Modal from '@/components/Modal.vue'

const auth = useAuthStore()
const toast = useToast()

const users = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const tooManyMatches = ref(false)
const loading = ref(false)

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadUsers() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/users', { params: { q: search.value, page: page.value } })
    users.value = data.users
    total.value = data.total
    pageSize.value = data.pageSize
    tooManyMatches.value = data.tooManyMatches
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
watch(page, loadUsers)

// Search after the admin stops typing for a moment
let searchTimer = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value === 1 ? loadUsers() : (page.value = 1)
  }, 300)
})

// ---------- actions ----------

function replaceUser(updated) {
  users.value = users.value.map((user) => (user._id === updated._id ? updated : user))
}

async function setRole(user, role) {
  const action = role === 'admin' ? 'make an admin' : 'remove admin rights from'
  if (!confirm(`Do you want to ${action} ${user.displayName}?`)) return
  try {
    const { data } = await api.patch(`/admin/users/${user._id}`, { role })
    replaceUser(data)
    toast.success(`${user.displayName} is now ${role === 'admin' ? 'an admin' : 'a regular user'}`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function setStatus(user, status) {
  if (status === 'disabled' && !confirm(`Disable ${user.displayName}? They will be logged out right away.`)) return
  try {
    const { data } = await api.patch(`/admin/users/${user._id}`, { status })
    replaceUser(data)
    toast.success(`${user.displayName} was ${status === 'disabled' ? 'disabled' : 'enabled'}`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

const tempPassword = ref(null) // { user, password } shown once in a pop-up

async function resetPassword(user) {
  if (!confirm(`Reset the password of ${user.displayName}? They will be logged out.`)) return
  try {
    const { data } = await api.post(`/admin/users/${user._id}/reset-password`)
    tempPassword.value = { user, password: data.tempPassword }
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(tempPassword.value.password)
    toast.success('Copied')
  } catch {
    toast.error('Could not copy. Please select and copy it manually.')
  }
}

async function deleteUser(user) {
  const typed = prompt(`This permanently deletes ${user.displayName}'s account, plans and inventory.\nType their username "${user.username}" to confirm:`)
  if (typed !== user.username) return
  try {
    await api.delete(`/admin/users/${user._id}`)
    toast.success(`${user.displayName} was deleted`)
    loadUsers()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl p-4 sm:p-6">
    <header class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">🛡️ Users</h1>
        <p class="text-sm text-muted">{{ total }} accounts</p>
      </div>
      <input v-model="search" class="input sm:w-72" placeholder="Name or username starts with…" aria-label="Search users" />
    </header>

    <p v-if="tooManyMatches" class="mb-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
      Showing the first {{ total }} matches. Type more letters to narrow the search.
    </p>

    <!-- A table on large screens. Smaller screens: each row becomes a stacked card, so nothing scrolls sideways. -->
    <div class="card overflow-hidden lg:overflow-x-auto">
      <table class="block w-full text-left text-sm lg:table lg:min-w-4xl">
        <thead class="hidden border-b border-line bg-hover text-xs text-muted uppercase lg:table-header-group">
          <tr>
            <th class="px-4 py-3 font-semibold">User</th>
            <th class="px-4 py-3 font-semibold">Role</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 font-semibold">Last login</th>
            <th class="px-4 py-3 font-semibold">Joined</th>
            <th class="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody class="block divide-y divide-line lg:table-row-group" :class="loading ? 'opacity-50' : ''">
          <tr v-for="user in users" :key="user._id" class="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 lg:table-row lg:p-0">
            <td class="w-full lg:w-auto lg:px-4 lg:py-3">
              <div class="flex items-center gap-3">
                <Avatar :user="user" size="sm" />
                <div class="min-w-0">
                  <p class="truncate font-medium text-fg">
                    {{ user.displayName }}
                    <span v-if="user._id === auth.user._id" class="text-xs font-normal text-subtle">(you)</span>
                  </p>
                  <p class="truncate text-xs text-muted">@{{ user.username }}</p>
                </div>
              </div>
            </td>
            <td class="lg:px-4 lg:py-3">
              <span v-if="user.role === 'admin'" class="badge badge-amber">Admin</span>
              <span v-else class="badge badge-gray">User</span>
            </td>
            <td class="lg:px-4 lg:py-3">
              <span v-if="user.status === 'active'" class="badge badge-green">Active</span>
              <span v-else class="badge badge-red">Disabled</span>
            </td>
            <td class="text-xs text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Last login </span>{{ user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never' }}
            </td>
            <td class="text-xs text-muted lg:px-4 lg:py-3 lg:text-sm">
              <span class="lg:hidden">Joined </span>{{ formatDate(user.createdAt) }}
            </td>
            <td class="w-full empty:hidden lg:w-auto lg:px-4 lg:py-3 lg:empty:table-cell">
              <div v-if="user._id !== auth.user._id" class="-ml-2.5 flex flex-wrap gap-1 lg:ml-0 lg:flex-nowrap lg:justify-end">
                <button v-if="user.role === 'user'" type="button" class="btn btn-ghost btn-sm" @click="setRole(user, 'admin')">
                  Make admin
                </button>
                <button v-else type="button" class="btn btn-ghost btn-sm" @click="setRole(user, 'user')">Remove admin</button>

                <button v-if="user.status === 'active'" type="button" class="btn btn-ghost btn-sm text-warn" @click="setStatus(user, 'disabled')">
                  Disable
                </button>
                <button v-else type="button" class="btn btn-ghost btn-sm text-success" @click="setStatus(user, 'active')">
                  Enable
                </button>

                <button type="button" class="btn btn-ghost btn-sm" @click="resetPassword(user)">Reset password</button>
                <button type="button" class="btn btn-ghost btn-sm text-danger" @click="deleteUser(user)">Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0" class="block lg:table-row">
            <td colspan="6" class="block px-4 py-8 text-center text-muted lg:table-cell">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="pageCount > 1" class="mt-4 flex items-center justify-center gap-2" aria-label="Pages">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="page === 1" @click="page--">‹ Previous</button>
      <span class="text-sm text-muted">Page {{ page }} of {{ pageCount }}</span>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="page === pageCount" @click="page++">Next ›</button>
    </nav>

    <Modal :open="!!tempPassword" title="Temporary password" size="sm" @update:open="tempPassword = null">
      <template v-if="tempPassword">
        <p class="text-sm text-muted">
          Give this password to <b>{{ tempPassword.user.displayName }}</b>. It is shown only once. They should change it in
          their profile after logging in.
        </p>
        <div class="mt-3 flex gap-2">
          <code class="min-w-0 flex-1 rounded-lg bg-hover px-3 py-2 font-mono text-base break-all select-all">{{ tempPassword.password }}</code>
          <button type="button" class="btn btn-secondary" @click="copyPassword">Copy</button>
        </div>
      </template>
    </Modal>
  </div>
</template>
