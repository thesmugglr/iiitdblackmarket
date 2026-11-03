import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BrowseFilterError, emptyBrowseFilters, loadBrowseListings, loadBrowseOverview, observeBrowse } from '../src/lib/browseState.ts'
import { CATEGORIES } from '../src/lib/constants.ts'

const now = '2026-11-03T00:00:00.000Z', listing = { id: 'l1', title: 'Fixture', category: 'books' }
const overview = { latest: [listing], counts: Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, c === 'books' ? 205 : 0])) }
const success = data => ({ data, error: null })
const failure = { data: null, count: null, error: { message: 'offline' } }
function api(response = success([listing])) {
  const calls = []
  return { calls, from(table) {
    const call = { table, query: [] }, b = {}; calls.push(call)
    for (const method of ['select', 'in', 'gt', 'eq', 'lte', 'or', 'order', 'limit']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.then = (yes, no) => {
      const result = typeof response === 'function' ? response(call) : response
      return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(yes, no)
    }
    return b
  } }
}
const overviewApi = (change = r => r) => api(call => {
  const category = call.query.find(([method]) => method === 'eq')?.[2]
  return change(category ? { data: null, count: overview.counts[category], error: null } : success(overview.latest), category)
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
function observer(overrides = {}) {
  const states = [], timers = [], searches = []
  const current = observeBrowse({
    loadOverview: () => overrides.overview ? overrides.overview() : Promise.resolve(overview),
    loadPage: async f => { searches.push(f); return { items: overrides.search ? await overrides.search(f) : [listing], next: null } },
    schedule: (callback, delay) => { const timer = { callback, delay, canceled: false }; timers.push(timer); return () => { timer.canceled = true } },
    publish: s => states.push(s),
  })
  return { ...current, states, timers, searches, run: () => timers.at(-1).callback(), latest: () => states.at(-1) }
}

test('category totals use exact HEAD counts beyond 200 and only fetch the three featured rows', async () => {
  const client = overviewApi()
  assert.deepEqual(await loadBrowseOverview(client, now), overview)
  assert.equal(client.calls.length, Object.keys(CATEGORIES).length + 1)
  assert.deepEqual(client.calls[0].query.slice(-3), [['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }], ['limit', 3]])
  for (const call of client.calls) {
    assert.ok(call.query.some(([m, key, values]) => m === 'in' && key === 'status' && values.join() === 'active,reserved'))
    assert.ok(call.query.some(([m, key, value]) => m === 'gt' && key === 'expires_at' && value === now))
  }
  for (const call of client.calls.slice(1)) {
    assert.deepEqual(call.query[0], ['select', 'id', { count: 'exact', head: true }])
    assert.equal(call.query.some(([m]) => m === 'limit'), false)
  }
})
for (const [name, response] of [['query failure', failure], ['missing featured data', success(null)], ['network exception', new Error('offline')]]) {
  test(`${name} cannot fabricate zero category totals`, async () => {
    await assert.rejects(loadBrowseOverview(overviewApi((r, category) => category ? r : response), now))
  })
}
for (const count of [null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) test(`unconfirmed category count ${count} rejects the entire overview`, async () => {
  await assert.rejects(loadBrowseOverview(overviewApi((r, category) => category === 'books' ? { ...r, count } : r), now))
})
test('a category failure cannot publish a partial summary while the featured query succeeds', async () => {
  await assert.rejects(loadBrowseOverview(overviewApi((r, category) => category === 'books' ? failure : r), now))
})
test('search keeps all business filters outside a quoted OR, including reserved punctuation and LIKE escapes', async () => {
  const client = api(), filters = { q: '(CS_101), "50%"\\C', category: 'books', type: 'rent', condition: 'good', maxPrice: '100', sort: 'low' }
  assert.deepEqual(await loadBrowseListings(client, filters, now), [listing])
  const query = client.calls[0].query
  const expression = query.find(([method]) => method === 'or')[1], split = expression.indexOf(',description.ilike.')
  const title = JSON.parse(expression.slice('title.ilike.'.length, split))
  const description = JSON.parse(expression.slice(split + ',description.ilike.'.length))
  assert.equal(title, '%(CS\\_101), "50\\%"\\\\C%'); assert.equal(description, title)
  for (const entry of [['eq', 'category', 'books'], ['eq', 'listing_type', 'rent'], ['eq', 'condition', 'good'], ['lte', 'price_inr', 100], ['gt', 'expires_at', now]]) assert.ok(query.some(actual => JSON.stringify(actual) === JSON.stringify(entry)))
  assert.deepEqual(query.slice(-4), [['order', 'price_inr', { ascending: true }], ['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }], ['limit', 61]])
})
for (const [sort, ascending] of [['low', true], ['high', false]]) test(`${sort} price sorting retains deterministic recency/ID ties`, async () => {
  const client = api(); await loadBrowseListings(client, { ...emptyBrowseFilters(), sort }, now)
  assert.ok(client.calls[0].query.some(([method, key, options]) => method === 'order' && key === 'price_inr' && options.ascending === ascending))
})
test('blank/control-only search omits OR; newest-first and active/unexpired filtering remain', async () => {
  const client = api(); await loadBrowseListings(client, { ...emptyBrowseFilters(), q: '\n\u0000 ' }, now)
  const query = client.calls[0].query
  assert.equal(query.some(([method]) => method === 'or'), false)
  assert.ok(query.some(([method, key]) => method === 'in' && key === 'status'))
  assert.ok(query.some(([method, key, value]) => method === 'gt' && key === 'expires_at' && value === now))
})
for (const [maxPrice, value] of [['0', 0], ['0.5', 0], ['25.9', 25], ['999999999999', 2147483647]]) test(`maximum price ${maxPrice} uses an equivalent valid int32 bound`, async () => {
  const client = api(); await loadBrowseListings(client, { ...emptyBrowseFilters(), maxPrice }, now)
  assert.ok(client.calls[0].query.some(([method, key, amount]) => method === 'lte' && key === 'price_inr' && amount === value))
})
for (const partial of [{ maxPrice: '-1' }, { maxPrice: 'NaN' }, { maxPrice: 'Infinity' }, { category: 'toString' }, { type: 'constructor' }, { condition: 'bad' }, { sort: 'random' }]) test(`invalid filters ${JSON.stringify(partial)} cannot start a query`, async () => {
  const client = api(); await assert.rejects(loadBrowseListings(client, { ...emptyBrowseFilters(), ...partial }, now), BrowseFilterError)
  assert.equal(client.calls.length, 0)
})
for (const response of [failure, success(null), new Error('offline')]) test('failed or missing search responses do not become empty matches', async () => {
  await assert.rejects(loadBrowseListings(api(response), emptyBrowseFilters(), now))
})
test('successful zero search results remain distinguishable from query failure', async () => {
  assert.deepEqual(await loadBrowseListings(api(success([])), emptyBrowseFilters(), now), [])
})
test('rapid filter changes cancel old debounce timers and freeze the final request values', async () => {
  const c = observer(), filters = { ...emptyBrowseFilters(), q: 'first' }
  c.setFilters(filters); const old = c.timers[0]
  filters.q = 'second'; c.setFilters(filters); filters.q = 'mutation after request'
  assert.equal(old.canceled, true); assert.equal(c.timers.at(-1).delay, 250)
  old.callback(); c.run(); await flush()
  assert.equal(c.searches.length, 1); assert.equal(c.searches[0].q, 'second'); assert.equal(c.latest().state, 'ok')
})
for (const outcome of ['success', 'failure']) test(`older search ${outcome} cannot replace newer filters/results`, async () => {
  const old = deferred(), c = observer({ search: f => f.q === 'old' ? old.promise : [listing] })
  c.setFilters({ ...emptyBrowseFilters(), q: 'old' }); c.run()
  c.setFilters({ ...emptyBrowseFilters(), q: 'new' }); c.run(); await flush()
  if (outcome === 'success') old.resolve([{ id: 'old listing' }]); else old.reject(new Error('old error'))
  await flush(); assert.deepEqual(c.latest().items, [listing]); assert.equal(c.latest().state, 'ok'); assert.equal(c.latest().error, '')
})
test('failed search ends loading; retry keeps filters and can confirm an empty result', async () => {
  let fail = true
  const c = observer({ search: () => { if (fail) throw new Error('offline'); return [] } })
  c.setFilters({ ...emptyBrowseFilters(), category: 'books' }); c.run(); await flush()
  assert.equal(c.latest().state, 'error'); assert.ok(c.latest().error)
  fail = false; c.retrySearch(); assert.equal(c.timers.at(-1).delay, 0); c.run(); await flush()
  assert.equal(c.searches[1].category, 'books'); assert.equal(c.latest().state, 'ok'); assert.deepEqual(c.latest().items, [])
})
test('validation failure has an actionable message and does not alter overview data', async () => {
  const c = observer({ search: () => { throw new BrowseFilterError('Enter a valid nonnegative maximum price.') } })
  c.setFilters(emptyBrowseFilters()); c.run(); await flush()
  assert.match(c.latest().error, /valid nonnegative/); assert.deepEqual(c.latest().overview, overview)
})
test('overview failure remains unknown until retry, and a later failure retains the whole confirmed summary', async () => {
  let fail = true
  const c = observer({ overview: async () => { if (fail) throw new Error('offline'); return overview } })
  await flush(); assert.equal(c.latest().overview, null); assert.equal(c.latest().overviewLoading, false); assert.ok(c.latest().overviewError)
  fail = false; await c.retryOverview(); assert.deepEqual(c.latest().overview, overview)
  fail = true; await c.retryOverview(); assert.deepEqual(c.latest().overview, overview); assert.ok(c.latest().overviewError)
})
for (const outcome of ['success', 'failure']) test(`older overview ${outcome} cannot replace a newer summary or search`, async () => {
  const old = deferred(); let first = true
  const c = observer({ overview: () => { if (first) { first = false; return old.promise } return Promise.resolve(overview) } })
  await c.retryOverview(); c.setFilters(emptyBrowseFilters()); c.run(); await flush()
  if (outcome === 'success') old.resolve({ latest: [], counts: {} }); else old.reject(new Error('old summary error'))
  await flush(); assert.deepEqual(c.latest().overview, overview); assert.equal(c.latest().overviewError, ''); assert.deepEqual(c.latest().items, [listing])
})
test('disposal cancels a pending debounce and even a late canceled callback cannot query', async () => {
  const c = observer(); c.setFilters(emptyBrowseFilters()); c.dispose(); const count = c.states.length
  assert.equal(c.timers[0].canceled, true); c.run(); c.retrySearch(); await c.retryOverview(); await flush()
  assert.equal(c.searches.length, 0); assert.equal(c.states.length, count)
})
for (const outcome of ['success', 'failure']) test(`old account search/overview ${outcome} cannot publish into the next account`, async () => {
  const oldSearch = deferred(), oldOverview = deferred(), old = observer({ search: () => oldSearch.promise, overview: () => oldOverview.promise })
  old.setFilters(emptyBrowseFilters()); old.run(); old.dispose(); const count = old.states.length
  const current = observer(); current.setFilters(emptyBrowseFilters()); current.run()
  if (outcome === 'success') { oldSearch.resolve([{ id: 'private old row' }]); oldOverview.resolve({ latest: [], counts: {} }) }
  else { oldSearch.reject(new Error('old error')); oldOverview.reject(new Error('old summary error')) }
  await flush(); assert.equal(old.states.length, count); assert.deepEqual(current.latest().items, [listing]); assert.deepEqual(current.latest().overview, overview)
})
