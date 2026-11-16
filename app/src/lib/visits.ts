// Cookie-free visit counter. Each device reports itself at most once a day; the database only adds to two daily
// totals (docs/visit-counter.md). Nothing identifying is sent or stored.
const LAST_KEY = 'smugglr_last_visit'
const SEEN_KEY = 'smugglr_seen_before'

export interface VisitPlan { send: boolean; newDevice: boolean }

/** Decide whether this device should be counted now. `today` is a local date like 2026-11-16. */
export function visitPlan(today: string, lastCounted: string | null, seenBefore: string | null): VisitPlan {
  if (lastCounted === today) return { send: false, newDevice: false }
  return { send: true, newDevice: seenBefore === null }
}

interface Rpc { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> }
type Store = Pick<Storage, 'getItem' | 'setItem'>

export const localDay = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

/** Count this visit once per device per day. Never throws and never blocks the page. */
export async function recordVisit(client: Rpc, store: Store | undefined = safeStorage(), now = new Date()): Promise<boolean> {
  try {
    if (!store) return false
    const today = localDay(now)
    const plan = visitPlan(today, store.getItem(LAST_KEY), store.getItem(SEEN_KEY))
    if (!plan.send) return false
    const { error } = await client.rpc('record_visit', { p_new_device: plan.newDevice })
    if (error) return false
    store.setItem(LAST_KEY, today)
    store.setItem(SEEN_KEY, today)
    return true
  } catch {
    return false
  }
}

function safeStorage(): Store | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}
