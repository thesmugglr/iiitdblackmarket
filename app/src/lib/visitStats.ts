// Admin-only visitor numbers: reads visit_summary() (returns rows only for approved admins) and totals them.
export interface VisitRow { day: string; visitors: number; new_devices: number }
export interface VisitTotals { visitors: number; newDevices: number }
export interface VisitSummary { today: VisitTotals; week: VisitTotals; month: VisitTotals; all: VisitTotals; days: VisitRow[] }

const sum = (rows: VisitRow[]): VisitTotals => ({
  visitors: rows.reduce((n, r) => n + r.visitors, 0),
  newDevices: rows.reduce((n, r) => n + r.new_devices, 0),
})

/** Totals for today, the last 7 and 30 days (including today) and everything returned. `today` is YYYY-MM-DD in India time. */
export function summarizeVisits(rows: VisitRow[], today: string): VisitSummary {
  const days = [...rows].sort((a, b) => (a.day < b.day ? 1 : -1))
  const since = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (n - 1))
    return d.toISOString().slice(0, 10)
  }
  const inRange = (from: string) => days.filter((r) => r.day >= from && r.day <= today)
  return { today: sum(days.filter((r) => r.day === today)), week: sum(inRange(since(7))), month: sum(inRange(since(30))), all: sum(days), days }
}

export const indiaToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

interface Rpc { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> }

export async function loadVisitSummary(client: Rpc, now = new Date()): Promise<VisitSummary> {
  const { data, error } = await client.rpc('visit_summary')
  if (error || !Array.isArray(data)) throw new Error('visit summary unavailable')
  const rows = data.map((r: VisitRow) => ({ day: String(r.day), visitors: Number(r.visitors) || 0, new_devices: Number(r.new_devices) || 0 }))
  return summarizeVisits(rows, indiaToday(now))
}
