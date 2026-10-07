import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/http'
import { socket } from '@/api/socket'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const checked = ref(false) // have we asked the server who we are yet?

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setUser(newUser) {
    user.value = newUser
    if (!socket.connected) socket.connect()
  }

  function clear() {
    user.value = null
    socket.disconnect()
  }

  /** Ask the server if our session cookie is still valid. */
  async function loadSession() {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      clear()
    } finally {
      checked.value = true
    }
  }

  async function login(form) {
    const { data } = await api.post('/auth/login', form)
    setUser(data)
  }

  async function register(form) {
    const { data } = await api.post('/auth/register', form)
    setUser(data)
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {})
    clear()
  }

  // The server closes our socket when the session is revoked (password change,
  // admin reset, account disabled). Check if we are still logged in; if so, reconnect.
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && user.value) loadSession()
  })

  return { user, checked, isLoggedIn, isAdmin, setUser, clear, loadSession, login, register, logout }
})
