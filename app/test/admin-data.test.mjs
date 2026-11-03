import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadAdminData, ADMIN_PAGE_SIZE } from '../src/lib/adminData.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const account = id(999999), approved = { id: account, role: 'admin', status: 'approved' }
const stamp = '2026-11-03T10:00:00.123456+00:00'
const row = n => ({ id: id(n), created_at: stamp, email: `fixture${n}@iiitd.ac.in`, status: 'pending' })
const success = data => ({ data, error: null })

function fixture({ users = [], reports = [], cap = ADMIN_PAGE_SIZE, profiles = [approved, approved], beforePage = () => {}, response = value => value } = {}) {
  const calls = [], profileCalls = []
  const source = { users, reports }
  const query = name => {
    const call = { name, order: [] }, b = {}
    b.order = (...args) => { call.order.push(args); return b }
    for (const method of ['select', 'eq', 'limit', 'or']) b[method] = (...args) => { call[method] = args; return b }
    b.then = (yes, no) => (async () => {
      calls.push(call); await beforePage(call, source)
      let rows = [...source[name]]
      const ascending = name === 'reports'
      rows.sort((a, b) => (a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) * (ascending ? 1 : -1))
      if (call.or) {
        const match = /^created_at\.(gt|lt)\."([^"]+)",and\(created_at\.eq\."\2",id\.\1\.([0-9a-f-]+)\)$/.exec(call.or[0])
        assert.ok(match, 'timestamp is quoted and boundary uses the same timestamp/operator twice')
        const [, op, time, after] = match
        rows = rows.filter(r => op === 'gt' ? r.created_at > time || (r.created_at === time && r.id > after) : r.created_at < time || (r.created_at === time && r.id < after))
      }
      const result = await response(success(rows.slice(0, Math.min(call.limit[0], cap))), call, source)
      return result
    })().then(yes, no)
    return b
  }
  const api = {
    rpc: name => {
      if (name === 'my_profile') return { maybeSingle: async () => { profileCalls.push(name); const next = profiles.shift(); if (next instanceof Error) throw next; return next?.error ? next : success(next ?? null) } }
      assert.equal(name, 'admin_profiles'); return query('users')
    },
    from: name => { assert.equal(name, 'reports'); return query('reports') },
  }
  return { api, calls, profileCalls, source }
}

test('loads both streams beyond 1,000 rows with bounded tied-timestamp keyset pages', async () => {
  const users = Array.from({ length: 1105 }, (_, i) => row(i + 1)), reports = Array.from({ length: 1023 }, (_, i) => ({ ...row(i + 2000), status: 'open' }))
  const f = fixture({ users, reports })
  const result = await loadAdminData(f.api, account)
  assert.deepEqual(result.users.map(r => r.id), users.map(r => r.id).reverse())
  assert.deepEqual(result.reports.map(r => r.id), reports.map(r => r.id))
  assert.equal(f.profileCalls.length, 2)
  for (const call of f.calls) {
    assert.deepEqual(call.limit, [200]); assert.equal(call.order.length, 2)
    assert.deepEqual(call.order, [['created_at', { ascending: call.name === 'reports' }], ['id', { ascending: call.name === 'reports' }]])
    if (call.name === 'reports') {
      assert.deepEqual(call.eq, ['status', 'open']); assert.match(call.select[0], /reporter:profiles.*display_name/)
    }
  }
})

test('a lower server cap cannot make a short page look complete', async () => {
  const rows = Array.from({ length: 17 }, (_, i) => row(i + 1)), f = fixture({ users: rows, reports: rows, cap: 3 })
  const result = await loadAdminData(f.api, account)
  assert.equal(result.users.length, 17); assert.equal(result.reports.length, 17)
  assert.equal(f.calls.filter(c => c.name === 'users').length, 7)
})

test('empty streams still require administrator confirmation before returning an empty result', async () => {
  const f = fixture()
  assert.deepEqual(await loadAdminData(f.api, account), { users: [], reports: [] })
  assert.equal(f.profileCalls.length, 2); assert.equal(f.calls.length, 2)
})

test('a removed page boundary and an unseen row do not shift continuation', async () => {
  let changed = false
  const rows = Array.from({ length: 10 }, (_, i) => row(i + 1)), f = fixture({ reports: rows, cap: 3,
    beforePage(call, source) {
      if (call.name === 'reports' && call.or && !changed) { source.reports = source.reports.filter(r => ![id(3), id(5)].includes(r.id)); changed = true }
    },
  })
  const result = await loadAdminData(f.api, account)
  assert.deepEqual(result.reports.map(r => r.id), rows.filter(r => r.id !== id(5)).map(r => r.id))
})

for (const profile of [null, { ...approved, id: id(8) }, { ...approved, role: 'student' }, { ...approved, status: 'pending' }, { ...approved, status: 'suspended' }, new Error('offline'), { error: { message: 'denied' } }]) {
  test('missing, mismatched or unapproved administrator cannot start private directory reads', async () => {
    const f = fixture({ profiles: [profile] })
    await assert.rejects(loadAdminData(f.api, account)); assert.equal(f.calls.length, 0)
  })
}

test('loss of administrator access before completion rejects the entire attempt', async () => {
  const f = fixture({ users: [row(1)], profiles: [approved, { ...approved, status: 'suspended' }] })
  await assert.rejects(loadAdminData(f.api, account), /access could not be confirmed/)
})

for (const bad of [{ data: null, error: null }, { data: [], error: { message: 'denied' } }, new Error('offline')]) {
  test('later page errors reject rather than publishing a partial queue', async () => {
    const f = fixture({ reports: [row(1), row(2)], cap: 1, response(result, call) {
      if (call.name === 'reports' && call.or) { if (bad instanceof Error) throw bad; return bad }
      return result
    } })
    await assert.rejects(loadAdminData(f.api, account)); assert.equal(f.profileCalls.length, 1)
  })
}

for (const badRow of [{ ...row(1), id: 'bad,id' }, { ...row(1), created_at: 'invalid' }, { ...row(1), created_at: `${stamp}),or(x)` }, null]) {
  test('malformed boundaries are rejected before reuse in a query', async () => {
    const f = fixture({ response: (result, call) => call.name === 'reports' ? success([badRow]) : result })
    await assert.rejects(loadAdminData(f.api, account), /Invalid administrator page boundary/)
    assert.equal(f.calls.filter(c => c.name === 'reports').length, 1)
  })
}

test('a repeated page cannot loop forever or duplicate rows', async () => {
  const f = fixture({ response: (result, call) => call.name === 'reports' ? success([row(1)]) : result })
  await assert.rejects(loadAdminData(f.api, account), /did not advance/)
  assert.equal(f.calls.filter(c => c.name === 'reports').length, 2)
})

test('out-of-order results cannot establish a valid continuation', async () => {
  const f = fixture({ response: (result, call) => call.name === 'reports' ? success([row(2), row(1)]) : result })
  await assert.rejects(loadAdminData(f.api, account), /did not advance/)
})

test('microseconds and equivalent timestamp offsets retain chronological progress', async () => {
  const rows = [{ ...row(1), created_at: '2026-11-03T10:00:00.123456Z' }, { ...row(2), created_at: '2026-11-03T11:00:00.123457+01:00' }]
  let sent = false
  const f = fixture({ response: (result, call) => { if (call.name !== 'reports' || sent) return result; sent = true; return success(rows) } })
  const result = await loadAdminData(f.api, account)
  assert.deepEqual(result.reports, rows)
  assert.ok(f.calls.some(c => c.or?.[0].includes('123457+01:00')))
})

test('superseded requests stop before further pages and never finish an old attempt', async () => {
  let live = true
  const f = fixture({ users: [row(1)], reports: [row(2)], beforePage() { live = false } })
  await assert.rejects(loadAdminData(f.api, account, () => live), /superseded/)
  assert.equal(f.profileCalls.length, 1); assert.equal(f.calls.every(c => !c.or), true)
})

test('a request superseded before starting does not query private data', async () => {
  const f = fixture()
  await assert.rejects(loadAdminData(f.api, account, () => false), /superseded/)
  assert.equal(f.profileCalls.length, 0); assert.equal(f.calls.length, 0)
})

test('invalid administrator account IDs do not query private data', async () => {
  const f = fixture()
  await assert.rejects(loadAdminData(f.api, 'not-an-id'))
  assert.equal(f.profileCalls.length, 0); assert.equal(f.calls.length, 0)
})
