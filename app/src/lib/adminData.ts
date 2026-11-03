import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from './types.ts'

type AdminApi = Pick<SupabaseClient, 'rpc' | 'from'>
interface Boundary { id: string; created_at: string }
type AdminMember = Profile & Boundary
export interface AdminReport extends Boundary {
  reason: string; status: string; listing_id: string | null; message_id: string | null
  reporter: { display_name: string } | null
}
export const ADMIN_PAGE_SIZE = 200
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/

function position(row: Boundary) {
  if (!row || typeof row.id !== 'string' || !uuid.test(row.id) || typeof row.created_at !== 'string') throw new Error('Invalid administrator page boundary')
  const match = timestamp.exec(row.created_at), milliseconds = Date.parse(row.created_at)
  if (!match || !Number.isFinite(milliseconds)) throw new Error('Invalid administrator page boundary')
  // Date.parse keeps milliseconds; retain the remaining PostgreSQL digits too.
  return { time: BigInt(milliseconds) * 1000n + BigInt((match[1] ?? '').padEnd(6, '0').slice(3)), id: row.id.toLowerCase() }
}

function boundary(after: Boundary, ascending: boolean) {
  position(after)
  const op = ascending ? 'gt' : 'lt'
  return `created_at.${op}."${after.created_at}",and(created_at.eq."${after.created_at}",id.${op}.${after.id})`
}

async function collect<T extends Boundary>(fetch: (after: Boundary | null) => PromiseLike<{ data: unknown; error: unknown }>, ascending: boolean, current: () => boolean): Promise<T[]> {
  const rows: T[] = []
  let after: Boundary | null = null, previous: ReturnType<typeof position> | null = null
  while (true) {
    if (!current()) throw new Error('Administrator load was superseded')
    const result = await fetch(after)
    if (!current()) throw new Error('Administrator load was superseded')
    if (result.error || !Array.isArray(result.data) || result.data.length > ADMIN_PAGE_SIZE) throw new Error('Administrator page unavailable')
    if (!result.data.length) return rows
    for (const row of result.data as T[]) {
      const next = position(row)
      if (previous) {
        const order = next.time < previous.time ? -1 : next.time > previous.time ? 1 : next.id < previous.id ? -1 : next.id > previous.id ? 1 : 0
        if (ascending ? order <= 0 : order >= 0) throw new Error('Administrator page did not advance')
      }
      rows.push(row); previous = next
      after = { id: row.id, created_at: row.created_at }
    }
    // A short page may reflect a lower server cap, so only an empty continuation
    // proves completion. Deletions/resolutions cannot shift a keyset boundary.
  }
}

export async function loadAdminData(api: AdminApi, account: string, current: () => boolean = () => true) {
  if (!uuid.test(account)) throw new Error('Administrator account unavailable')
  const confirm = async () => {
    if (!current()) throw new Error('Administrator load was superseded')
    const result = await api.rpc('my_profile').maybeSingle()
    if (!current()) throw new Error('Administrator load was superseded')
    const profile = result.data as Profile | null
    if (result.error || profile?.id !== account || profile.role !== 'admin' || profile.status !== 'approved') throw new Error('Administrator access could not be confirmed')
  }
  await confirm()
  let failed = false
  const running = () => !failed && current()
  try {
    const [users, reports] = await Promise.all([
      collect<AdminMember>(after => {
        let query = api.rpc('admin_profiles').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(ADMIN_PAGE_SIZE)
        if (after) query = query.or(boundary(after, false))
        return query
      }, false, running),
      collect<AdminReport>(after => {
        let query = api.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(display_name)').eq('status', 'open')
          .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(ADMIN_PAGE_SIZE)
        if (after) query = query.or(boundary(after, true))
        return query
      }, true, running),
    ])
    await confirm()
    return { users, reports }
  } catch (error) { failed = true; throw error }
}
