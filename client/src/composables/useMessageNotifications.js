import { onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { socket } from '@/api/socket'
import { countUnseen, showDesktopNotification } from './useDesktopNotifications'
import { useToast } from './useToast'

/**
 * Pop-ups for new messages and posts in the rooms/channels you're a member of (used once, in App.vue).
 * The server sends 'notify' to everyone in the place except the author. We skip it when you are
 * already looking at that room/channel, and keep one toast per place (the newest message replaces it).
 * When NexFlow isn't in front, it also becomes a system notification and counts in the tab title.
 */
export function useMessageNotifications() {
  const route = useRoute()
  const toast = useToast()

  function onNotify({ placeType, placeId, placeName, isDirect, from, preview }) {
    const link = `/${placeType}s/${placeId}`
    const lookingAtIt = route.path === link && document.visibilityState === 'visible' && document.hasFocus()
    if (lookingAtIt) return

    const title = isDirect
      ? `💬 ${from.displayName}`
      : placeType === 'room'
        ? `💬 ${from.displayName} in ${placeName}`
        : `📢 ${from.displayName} posted in ${placeName}`

    // Not on that page right now (or the window is in the background): the in-app pop-up
    if (route.path !== link) toast.notify(preview, 10000, { title, user: from, link, key: `place:${placeId}` })
    countUnseen()
    showDesktopNotification({ title, body: preview, link, tag: `place:${placeId}` })
  }

  // Someone started a private chat with us ("Send message")
  function onDirect({ id, name, from }) {
    const link = `/rooms/${id}`
    const title = `💬 ${from.displayName} started a private chat with you`
    toast.notify(name, 10000, { title, user: from, link, key: `place:${id}` })
    countUnseen()
    showDesktopNotification({ title, body: name, link, tag: `place:${id}` })
  }

  socket.on('notify', onNotify)
  socket.on('room:direct', onDirect)
  onUnmounted(() => {
    socket.off('notify', onNotify)
    socket.off('room:direct', onDirect)
  })
}
