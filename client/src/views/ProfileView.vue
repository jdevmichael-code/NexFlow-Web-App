<script setup>
import { computed, reactive, ref } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import Avatar from '@/components/Avatar.vue'

const auth = useAuthStore()
const toast = useToast()

// ---------- avatar ----------
const avatarInput = ref(null)
const uploading = ref(false)

async function uploadAvatar(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) return toast.error('Image is too big (max 10 MB)')

  uploading.value = true
  try {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post('/users/me/avatar', form)
    auth.user = data
    toast.success('Profile picture updated')
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    uploading.value = false
  }
}

// ---------- profile ----------
const profile = reactive({ displayName: auth.user.displayName, bio: auth.user.bio || '' })
const savingProfile = ref(false)

async function saveProfile() {
  savingProfile.value = true
  try {
    const { data } = await api.put('/users/me', profile)
    auth.user = data
    toast.success('Profile saved')
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingProfile.value = false
  }
}

// ---------- password ----------
const passwords = reactive({ currentPassword: '', newPassword: '', confirm: '' })
const savingPassword = ref(false)

const passwordProblem = computed(() => {
  const p = passwords.newPassword
  if (!p) return ''
  if (p.length < 8) return 'At least 8 characters'
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return 'Use at least one letter and one number'
  if (p !== passwords.confirm) return 'Passwords do not match'
  return ''
})

async function changePassword() {
  savingPassword.value = true
  try {
    await api.post('/auth/change-password', {
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    })
    Object.assign(passwords, { currentPassword: '', newPassword: '', confirm: '' })
    toast.success('Password changed. Your other devices were logged out.')
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl p-4 sm:p-6">
    <h1 class="page-title mb-6">Your profile</h1>

    <section class="card mb-6 flex flex-col items-center gap-4 p-6 sm:flex-row">
      <Avatar :user="auth.user" size="xl" />
      <div class="flex-1 text-center sm:text-left">
        <p class="text-xl font-semibold text-fg">{{ auth.user.displayName }}</p>
        <p class="text-sm text-muted">
          @{{ auth.user.username }} · Joined {{ formatDate(auth.user.createdAt) }}
          <span v-if="auth.isAdmin" class="badge ml-1 badge-amber">Admin</span>
        </p>
        <button type="button" class="btn btn-secondary mt-3" :disabled="uploading" @click="avatarInput.click()">
          {{ uploading ? 'Uploading…' : '📷 Change picture' }}
        </button>
        <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" @change="uploadAvatar" />
      </div>
    </section>

    <div class="grid gap-6 md:grid-cols-2">
      <form class="card flex flex-col gap-4 p-6" @submit.prevent="saveProfile">
        <h2 class="font-semibold text-fg">Profile settings</h2>
        <div>
          <label class="label" for="displayName">Display name</label>
          <input id="displayName" v-model="profile.displayName" class="input" maxlength="40" required />
        </div>
        <div>
          <label class="label" for="bio">About you</label>
          <textarea id="bio" v-model="profile.bio" class="input" rows="4" maxlength="300" placeholder="A few words about yourself" />
          <p class="mt-1 text-right text-xs text-subtle">{{ profile.bio.length }}/300</p>
        </div>
        <button type="submit" class="btn btn-primary self-end" :disabled="savingProfile">
          {{ savingProfile ? 'Saving…' : 'Save' }}
        </button>
      </form>

      <form class="card flex flex-col gap-4 p-6" @submit.prevent="changePassword">
        <h2 class="font-semibold text-fg">Change password</h2>
        <input type="text" :value="auth.user.username" autocomplete="username" class="hidden" readonly aria-hidden="true" />
        <div>
          <label class="label" for="currentPassword">Current password</label>
          <input id="currentPassword" v-model="passwords.currentPassword" type="password" class="input" autocomplete="current-password" required />
        </div>
        <div>
          <label class="label" for="newPassword">New password</label>
          <input id="newPassword" v-model="passwords.newPassword" type="password" class="input" autocomplete="new-password" maxlength="72" required />
        </div>
        <div>
          <label class="label" for="confirmPassword">Confirm new password</label>
          <input id="confirmPassword" v-model="passwords.confirm" type="password" class="input" autocomplete="new-password" required />
          <p v-if="passwordProblem" class="mt-1 text-xs text-danger">{{ passwordProblem }}</p>
        </div>
        <button
          type="submit"
          class="btn btn-primary self-end"
          :disabled="savingPassword || !!passwordProblem || !passwords.newPassword || !passwords.currentPassword"
        >
          {{ savingPassword ? 'Saving…' : 'Change password' }}
        </button>
      </form>
    </div>
  </div>
</template>
