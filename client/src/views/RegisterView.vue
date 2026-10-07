<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ username: '', displayName: '', password: '', confirm: '' })
const error = ref('')
const loading = ref(false)

// Same rules as the server, shown live so users know what's missing
const rules = computed(() => [
  { text: 'At least 8 characters', ok: form.password.length >= 8 },
  { text: 'Contains a letter', ok: /[a-zA-Z]/.test(form.password) },
  { text: 'Contains a number', ok: /[0-9]/.test(form.password) },
  { text: 'Passwords match', ok: !!form.password && form.password === form.confirm },
])
const passwordOk = computed(() => rules.value.every((rule) => rule.ok))

async function register() {
  error.value = ''
  loading.value = true
  try {
    await auth.register({ username: form.username, displayName: form.displayName, password: form.password })
    router.push('/')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-fg">Create your account</h1>
        <p class="text-sm text-muted">Join NexFlow in a few seconds</p>
      </div>

      <form class="card flex flex-col gap-4 p-6" @submit.prevent="register">
        <p v-if="error" role="alert" class="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div>
          <label class="label" for="username">Username</label>
          <input
            id="username"
            v-model="form.username"
            class="input"
            autocomplete="username"
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3-20 characters: letters, numbers or _"
            required
            autofocus
          />
          <p class="mt-1 text-xs text-muted">3-20 characters: letters, numbers or _</p>
        </div>

        <div>
          <label class="label" for="displayName">Display name</label>
          <input id="displayName" v-model="form.displayName" class="input" autocomplete="name" maxlength="40" required />
        </div>

        <div>
          <label class="label" for="password">Password</label>
          <input id="password" v-model="form.password" type="password" class="input" autocomplete="new-password" maxlength="72" required />
        </div>

        <div>
          <label class="label" for="confirm">Confirm password</label>
          <input id="confirm" v-model="form.confirm" type="password" class="input" autocomplete="new-password" required />
        </div>

        <ul class="grid grid-cols-2 gap-1 text-xs">
          <li v-for="rule in rules" :key="rule.text" :class="rule.ok ? 'text-success' : 'text-subtle'">
            {{ rule.ok ? '✓' : '○' }} {{ rule.text }}
          </li>
        </ul>

        <button type="submit" class="btn btn-primary w-full" :disabled="loading || !passwordOk">
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-muted">
        Already have an account?
        <RouterLink to="/login" class="font-medium text-accent hover:underline">Log in</RouterLink>
      </p>
    </div>
  </div>
</template>
