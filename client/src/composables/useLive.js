import { onMounted, onUnmounted } from 'vue'
import { socket } from '@/api/socket'

/**
 * Get live updates for a room or channel while this component is on screen.
 *
 *   useLive('room', roomId, {
 *     'message:new': (message) => messages.value.push(message),
 *   })
 *
 * Joins the socket room on mount (and again after a reconnect), listens to the
 * given events, and cleans everything up on unmount.
 * Returns `join()` so a page can re-join right after the user becomes a member.
 */
export function useLive(type, id, events) {
  const join = () => socket.emit(`${type}:join`, id)

  onMounted(() => {
    socket.on('connect', join)
    if (socket.connected) join()
    for (const [name, handler] of Object.entries(events)) socket.on(name, handler)
  })

  onUnmounted(() => {
    socket.off('connect', join)
    socket.emit(`${type}:leave`, id)
    for (const [name, handler] of Object.entries(events)) socket.off(name, handler)
  })

  return { join }
}
