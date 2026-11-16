import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indiaToday, loadVisitSummary, summarizeVisits } from '../src/lib/visitStats.ts'

const rows = [
  { day: '2026-11-16', visitors: 10, new_devices: 4 },
  { day: '2026-11-10', visitors: 6, new_devices: 2 },
  { day: '2026-11-09', visitors: 5, new_devices: 1 },
  { day: '2026-10-18', visitors: 3, new_devices: 3 },
  { day: '2026-10-17', visitors: 100, new_devices: 50 },
]

test('summarizeVisits totals today, 7 days, 30 days and all time', () => {
  const s = summarizeVisits(rows, '2026-11-16')
  assert.deepEqual(s.today, { visitors: 10, newDevices: 4 })
  assert.deepEqual(s.week, { visitors: 16, newDevices: 6 }, '16 Nov back to 10 Nov')
  assert.deepEqual(s.month, { visitors: 24, newDevices: 10 }, '18 Oct is the first day of the window; 17 Oct is out')
  assert.deepEqual(s.all, { visitors: 124, newDevices: 60 })
  assert.equal(s.days[0].day, '2026-11-16')
})

test('summarizeVisits handles no data and India-time dates', () => {
  assert.deepEqual(summarizeVisits([], '2026-11-16').all, { visitors: 0, newDevices: 0 })
  assert.equal(indiaToday(new Date('2026-11-15T20:00:00Z')), '2026-11-16')
})

test('loadVisitSummary rejects on errors and non-lists (non-admins get an empty list, never data)', async () => {
  await assert.rejects(loadVisitSummary({ rpc: async () => ({ data: null, error: { message: 'x' } }) }), /unavailable/)
  await assert.rejects(loadVisitSummary({ rpc: async () => ({ data: null, error: null }) }), /unavailable/)
  const s = await loadVisitSummary({ rpc: async (n) => ({ data: n === 'visit_summary' ? [] : null, error: null }) })
  assert.equal(s.all.visitors, 0)
})
