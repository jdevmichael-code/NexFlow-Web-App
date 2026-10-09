import { onMounted, onUnmounted, ref } from 'vue'

/**
 * True while a CSS media query matches, and updates when the window is resized.
 *
 *   const isDesktop = useMediaQuery(DESKTOP)
 *   <UserList v-if="isDesktop" />   // not even created on phones
 */
export function useMediaQuery(query) {
  const media = window.matchMedia(query)
  const matches = ref(media.matches)
  const update = (event) => (matches.value = event.matches)

  onMounted(() => media.addEventListener('change', update))
  onUnmounted(() => media.removeEventListener('change', update))
  return matches
}

/** Same width as Tailwind's `lg:` breakpoint. */
export const DESKTOP = '(min-width: 64rem)'
