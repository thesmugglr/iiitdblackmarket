// Instagram-style time labels for chats.

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR

/** Status under your newest message: "Seen just now", "Seen 5m ago", "Seen 2h ago", "Seen 3d ago", "Seen 2w ago". */
export function seenLabel(readAt: string, now: number) {
  const ago = Math.max(0, now - new Date(readAt).getTime())
  if (ago < MIN) return 'Seen just now'
  if (ago < HOUR) return `Seen ${Math.floor(ago / MIN)}m ago`
  if (ago < DAY) return `Seen ${Math.floor(ago / HOUR)}h ago`
  if (ago < 7 * DAY) return `Seen ${Math.floor(ago / DAY)}d ago`
  return `Seen ${Math.floor(ago / (7 * DAY))}w ago`
}

/** Gap after which a centered time header starts a new batch of messages. */
export const HEADER_GAP = HOUR

/** Centered header text: "10:51 PM" today, "Yesterday 9:02 PM", "Mon 3:10 PM" this week, else "12 Nov, 3:10 PM". */
export function timeHeader(iso: string, now: number) {
  const d = new Date(iso), today = new Date(now)
  const clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const t = d.getTime()
  if (t >= startOfToday) return clock
  if (t >= startOfToday - DAY) return `Yesterday ${clock}`
  if (t >= startOfToday - 6 * DAY) return `${d.toLocaleDateString([], { weekday: 'short' })} ${clock}`
  const sameYear = d.getFullYear() === today.getFullYear()
  return `${d.toLocaleDateString([], sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })}, ${clock}`
}

/** Whether a header goes above this message: the first one, or after a quiet hour. */
export const needsHeader = (prev: string | undefined, cur: string) =>
  !prev || new Date(cur).getTime() - new Date(prev).getTime() >= HEADER_GAP

/** A horizontal drag: right far enough is a reply, left reveals times. Small or mostly vertical moves are neither. */
export const REPLY_AT = 56
export function swipeIntent(dx: number, dy: number): 'none' | 'reply' | 'reveal' {
  if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return 'none'
  return dx > 0 ? 'reply' : 'reveal'
}
