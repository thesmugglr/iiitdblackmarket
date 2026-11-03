import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BROWSE_PAGE_SIZE, emptyBrowseFilters, loadBrowsePage, observeBrowse } from '../src/lib/browseState.ts'

const time = '2026-11-03T00:00:00.123456+00:00', now = '2026-11-03T00:00:00.000Z'
const row = i => ({ id: `00000000-0000-0000-0000-${i.toString(16).padStart(12, '0')}`, created_at: time, price_inr: 50, title: `Fixture ${i}` })
const cursor = (i, sort = 'new') => ({ id: row(i).id, created_at: time, price_inr: 50, sort })
function api(rows) {
  const calls = []
  return { calls, from(table) {
    const query = [], b = {}; calls.push({ table, query })
    for (const method of ['select', 'in', 'gt', 'eq', 'lte', 'or', 'order', 'limit']) b[method] = (...args) => { query.push([method, ...args]); return b }
    b.then = (yes, no) => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve({ data: rows, error: null })).then(yes, no)
    return b
  } }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
function observer(...pages) {
  const states = [], calls = [], timers = []
  const current = observeBrowse({
    loadOverview: async () => ({ latest: [], counts: {} }),
    loadPage: async (filters, after) => {
      calls.push({ filters, after })
      assert.ok(pages.length, 'unexpected page request')
      const result = await pages.shift()
      if (result instanceof Error) throw result
      return result
    },
    schedule: callback => { const timer = { callback, canceled: false }; timers.push(timer); return () => { timer.canceled = true } },
    publish: snapshot => states.push(snapshot),
  })
  return { ...current, states, calls, run: () => timers.at(-1).callback(), latest: () => states.at(-1),
    start: async (filters = emptyBrowseFilters()) => { current.setFilters(filters); timers.at(-1).callback(); await flush() },
  }
}

for (const count of [0, 1, 59, 60, 61]) test(`${count} server rows confirm one bounded page and exact lookahead state`, async () => {
  const client = api(Array.from({ length: count }, (_, i) => row(i + 1)))
  const page = await loadBrowsePage(client, emptyBrowseFilters(), null, now)
  assert.equal(page.items.length, Math.min(count, BROWSE_PAGE_SIZE))
  assert.deepEqual(page.next, count > BROWSE_PAGE_SIZE ? cursor(60) : null)
  assert.deepEqual(client.calls[0].query.at(-1), ['limit', BROWSE_PAGE_SIZE + 1])
})
for (const sort of ['new', 'low', 'high']) test(`${sort} page boundary preserves microseconds and deterministic ties`, async () => {
  const client = api([]), after = cursor(60, sort)
  await loadBrowsePage(client, { ...emptyBrowseFilters(), sort }, after, now)
  const query = client.calls[0].query, expression = query.find(([method]) => method === 'or')[1]
  assert.ok(expression.includes(`created_at.lt.${JSON.stringify(time)}`))
  assert.ok(expression.includes(`created_at.eq.${JSON.stringify(time)},id.lt.${JSON.stringify(after.id)}`))
  if (sort === 'new') assert.equal(expression.startsWith('created_at.lt.'), true)
  else assert.ok(expression.startsWith(`price_inr.${sort === 'low' ? 'gt' : 'lt'}.50,`))
  assert.deepEqual(query.slice(-3), [['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }], ['limit', 61]])
})
test('search and page OR groups are conjoined while category/type/price filters remain applied', async () => {
  const client = api([])
  await loadBrowsePage(client, { ...emptyBrowseFilters(), q: 'Notes (CS_101), "50%"', category: 'books', type: 'rent', maxPrice: '100', sort: 'low' }, cursor(60, 'low'), now)
  const query = client.calls[0].query, logic = query.filter(([method]) => method === 'or')
  assert.equal(logic.length, 1); assert.ok(logic[0][1].startsWith('and(or(title.ilike.'))
  assert.ok(logic[0][1].includes('),or(price_inr.gt.50,'))
  assert.ok(query.some(([method, field, value]) => method === 'eq' && field === 'category' && value === 'books'))
  assert.ok(query.some(([method, field, value]) => method === 'lte' && field === 'price_inr' && value === 100))
})
for (const partial of [
  { id: 'x),price_inr.gt.0' }, { created_at: 'not a timestamp' }, { created_at: '2026-11-03T00:00:00.1234567Z' },
  { price_inr: -1 }, { price_inr: 0.5 }, { price_inr: Infinity }, { sort: 'high' },
]) test(`invalid/mismatched cursor ${JSON.stringify(partial)} cannot start a query`, async () => {
  const client = api([])
  await assert.rejects(loadBrowsePage(client, emptyBrowseFilters(), { ...cursor(60), ...partial }, now), /boundary/)
  assert.equal(client.calls.length, 0)
})
test('an unconfirmed next cursor cannot expose a more-results loop', async () => {
  const rows = Array.from({ length: 61 }, (_, i) => row(i + 1))
  rows[59] = { ...rows[59], created_at: 'missing date' }
  await assert.rejects(loadBrowsePage(api(rows), emptyBrowseFilters(), null, now), /boundary/)
})
test('a server page whose next boundary did not advance is rejected', async () => {
  const rows = Array.from({ length: 61 }, (_, i) => row(i + 1))
  await assert.rejects(loadBrowsePage(api(rows), emptyBrowseFilters(), cursor(60), now), /boundary/)
})

test('load more appends a confirmed page once and disappears at exhaustion', async () => {
  const pending = deferred(), c = observer({ items: [row(1)], next: cursor(1) }, pending.promise)
  await c.loadMore(); assert.equal(c.calls.length, 0)
  await c.start(); const loading = c.loadMore()
  assert.equal(c.latest().loadingMore, true); await c.loadMore(); assert.equal(c.calls.length, 2)
  pending.resolve({ items: [row(2)], next: null }); await loading
  assert.deepEqual(c.latest().items.map(l => l.id), [row(1).id, row(2).id])
  assert.equal(c.latest().hasMore, false); assert.equal(c.latest().loadingMore, false)
  await c.loadMore(); assert.equal(c.calls.length, 2)
})
test('failed append retains cards and its cursor; retry can confirm the same next page', async () => {
  const c = observer({ items: [row(1)], next: cursor(1) }, new Error('lost page reply'), { items: [row(2)], next: null })
  await c.start(); await c.loadMore()
  assert.deepEqual(c.latest().items, [row(1)]); assert.equal(c.latest().state, 'ok'); assert.equal(c.latest().hasMore, true); assert.ok(c.latest().moreError)
  await c.loadMore(); assert.deepEqual(c.calls[1].after, c.calls[2].after)
  assert.deepEqual(c.latest().items, [row(1), row(2)]); assert.equal(c.latest().moreError, '')
})
test('moved/duplicate IDs render once while the raw cursor continues advancing', async () => {
  const c = observer({ items: [row(1)], next: cursor(1) }, { items: [row(1), row(2), row(2)], next: cursor(3) }, { items: [row(4)], next: null })
  await c.start(); await c.loadMore(); await c.loadMore()
  assert.deepEqual(c.latest().items, [row(1), row(2), row(4)])
  assert.deepEqual(c.calls[2].after, cursor(3))
})
test('a duplicate-only page still advances rather than fetching the same page forever', async () => {
  const c = observer({ items: [row(1)], next: cursor(1) }, { items: [row(1)], next: cursor(2) }, { items: [row(3)], next: null })
  await c.start(); await c.loadMore(); assert.deepEqual(c.latest().items, [row(1)])
  await c.loadMore(); assert.deepEqual(c.calls[2].after, cursor(2)); assert.deepEqual(c.latest().items, [row(1), row(3)])
})
test('non-advancing append keeps the confirmed cards and boundary available for retry', async () => {
  const c = observer({ items: [row(1)], next: cursor(1) }, { items: [row(2)], next: cursor(1) }, { items: [row(2)], next: null })
  await c.start(); await c.loadMore()
  assert.deepEqual(c.latest().items, [row(1)]); assert.ok(c.latest().moreError)
  await c.loadMore(); assert.deepEqual(c.latest().items, [row(1), row(2)])
})
for (const outcome of ['success', 'failure']) test(`filter reset discards an old append ${outcome}`, async () => {
  const pending = deferred(), c = observer({ items: [row(1)], next: cursor(1) }, pending.promise, { items: [row(9)], next: null })
  await c.start(); const loading = c.loadMore()
  await c.start({ ...emptyBrowseFilters(), category: 'books' })
  if (outcome === 'success') pending.resolve({ items: [row(2)], next: cursor(2) }); else pending.reject(new Error('old append error'))
  await loading; assert.deepEqual(c.latest().items, [row(9)]); assert.equal(c.latest().moreError, ''); assert.equal(c.latest().hasMore, false)
})
test('refresh restarts the same filters from page one and ignores an in-flight append', async () => {
  const pending = deferred(), c = observer({ items: [row(1)], next: cursor(1) }, pending.promise, { items: [row(9)], next: cursor(9) })
  await c.start({ ...emptyBrowseFilters(), q: 'retained search', sort: 'low' }); const loading = c.loadMore()
  c.retrySearch(); c.run(); await flush(); pending.resolve({ items: [row(2)], next: null }); await loading
  assert.equal(c.calls[2].after, null); assert.equal(c.calls[2].filters.q, 'retained search'); assert.equal(c.calls[2].filters.sort, 'low')
  assert.deepEqual(c.latest().items, [row(9)]); assert.equal(c.latest().hasMore, true)
})
test('page metadata is copied so later source mutation cannot change the next request', async () => {
  const first = { items: [row(1)], next: cursor(1) }, c = observer(first, { items: [], next: null })
  await c.start(); first.next.id = row(999).id; await c.loadMore()
  assert.deepEqual(c.calls[1].after, cursor(1))
})
test('refresh can discover newly available rows after a confirmed empty result', async () => {
  const c = observer({ items: [], next: null }, { items: [row(9)], next: null })
  await c.start(); assert.deepEqual(c.latest().items, []); assert.equal(c.latest().hasMore, false)
  c.retrySearch(); c.run(); await flush()
  assert.equal(c.calls[1].after, null); assert.deepEqual(c.latest().items, [row(9)])
})
for (const outcome of ['success', 'failure']) test(`disposed account append ${outcome} cannot publish into a new account`, async () => {
  const pending = deferred(), old = observer({ items: [row(1)], next: cursor(1) }, pending.promise)
  await old.start(); const loading = old.loadMore(); old.dispose(); const count = old.states.length
  const current = observer({ items: [row(9)], next: null }); await current.start()
  if (outcome === 'success') pending.resolve({ items: [row(2)], next: null }); else pending.reject(new Error('old append failure'))
  await loading; await old.loadMore()
  assert.equal(old.states.length, count); assert.deepEqual(current.latest().items, [row(9)]); assert.equal(current.latest().moreError, '')
})
