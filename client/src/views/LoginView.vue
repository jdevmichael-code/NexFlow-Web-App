<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ username: '', password: '', remember: false })
const error = ref('')
const loading = ref(false)

async function login() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(form)
    // Only follow redirects inside our own app
    const redirect = String(route.query.redirect || '/')
    router.push(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
  } catch (err) {
    error.value = errorMessage(err)
    form.password = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <span class="inline-flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-2xl font-bold text-white">N</span>
        <h1 class="mt-3 text-2xl font-bold text-fg">Welcome to NexFlow</h1>
        <p class="text-sm text-muted">Log in to start chatting</p>
      </div>

      <form class="card flex flex-col gap-4 p-6" @submit.prevent="login">
        <p v-if="error" role="alert" class="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div>
          <label class="label" for="username">Username</label>
          <input id="username" v-model="form.username" class="input" autocomplete="username" required autofocus />
        </div>

        <div>
          <label class="label" for="password">Password</label>
          <input id="password" v-model="form.password" type="password" class="input" autocomplete="current-password" required />
        </div>

        <label class="flex items-center gap-2 text-sm text-muted">
          <input v-model="form.remember" type="checkbox" class="accent-indigo-600" />
          Remember me for 7 days
        </label>

        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-muted">
        New here?
        <RouterLink to="/register" class="font-medium text-accent hover:underline">Create an account</RouterLink>
      </p>
    </div>
  </div>
</template>
