/** URL of an uploaded file, from the path stored in CouchDB. */
export const fileUrl = (path) => (path ? `/files/${path}` : null)

/** 1536000 → "1.5 MB" */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "10:42 AM" for today, "Oct 2, 10:42 AM" for other days. */
export function formatTime(iso) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (toDateKey(date) === toDateKey(new Date())) return time
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

/** "Oct 2, 2026" */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

/** "just now", "5 min ago", "3 h ago", or a date. */
export function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return formatDate(iso)
}

/** A Date → "2026-10-02" in local time (toISOString would use UTC and can shift the day). */
export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** "09:30" → "9:30 AM" */
export function formatPlanTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
