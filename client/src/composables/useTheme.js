import { ref } from 'vue'

// Light/dark theme. public/theme.js already applied the saved theme on page load;
// this reads it and lets the toggle button change it.
const STORAGE_KEY = 'nexflow-theme'
const theme = ref(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')

export function useTheme() {
  function setTheme(value) {
    theme.value = value
    document.documentElement.setAttribute('data-theme', value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // storage blocked: the theme still changes, it just isn't remembered
    }
  }

  const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark')

  return { theme, toggleTheme }
}
