import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addStudentRoster } from '../src/lib/adminActions.ts'

const email = i => `fixture${i}@iiitd.ac.in`
const addresses = Array.from({ length: 1005 }, (_, i) => email(i))
const member = (id, status = 'pending') => ({ id: String(id), email: email(id), status })
function fixture({ members = [], effect = () => {}, reply = result => result } = {}) {
  const calls = [], roster = new Set(), profiles = new Map(members.map(m => [m.id, { ...m }]))
  const api = { from(table) {
    const call = { table, filters: [] }, b = {}
    for (const method of ['upsert', 'update', 'select']) b[method] = value => { call[method] = value; return b }
    b.eq = (key, value) => { call.filters.push([key, value]); return b }
    const run = async () => {
      calls.push(call)
      let data
      if (table === 'student_roster') {
        for (const { email } of call.upsert) roster.add(email)
        data = call.upsert
      } else {
        const id = call.filters.find(([key]) => key === 'id')?.[1], row = profiles.get(id)
        if (call.update) {
          if (row && call.filters.every(([key, value]) => row[key] === value)) { Object.assign(row, call.update); data = { id: row.id, status: row.status } }
          else data = null
        } else data = row ? { id: row.id, status: row.status } : null
      }
      await effect(call, { calls, roster, profiles })
      return reply({ data, error: null }, call, { calls, roster, profiles })
    }
    b.single = b.maybeSingle = run
    b.then = (yes, no) => run().then(yes, no)
    return b
  } }
  return { api, calls, roster, profiles }
}

test('1,005 deduplicated addresses retain one atomic write before pending-member approvals', async () => {
  const users = [member(0), member(1004)], f = fixture({ members: users })
  const result = await addStudentRoster(f.api, `${addresses.join('\n')} ${email(0).toUpperCase()}`, users)
  assert.deepEqual(result, { added: 1005, approved: 2, failed: 0 })
  assert.equal(f.roster.size, 1005)
  assert.deepEqual(f.calls.filter(c => c.upsert).map(c => c.upsert.length), [1005])
  assert.equal(f.calls.findIndex(c => c.table === 'profiles'), 1)
  for (const call of f.calls.filter(c => c.update)) assert.deepEqual(call.filters, [['id', call.filters[0][1]], ['status', 'pending']])
})

test('an invalid final address prevents every write, even for a large valid prefix', async () => {
  const f = fixture()
  await assert.rejects(addStudentRoster(f.api, `${addresses.join(' ')} invalid@gmail.com`, []), /no entries were added/)
  assert.equal(f.calls.length, 0)
})

for (const transport of [false, true]) test(`uncertain write safely retries without premature approval (${transport ? 'exception' : 'error reply'})`, async () => {
  let fail = true
  const users = [member(0)], f = fixture({ members: users, reply(result, call) {
    if (call.upsert && fail) { if (transport) throw new Error('lost reply'); return { data: null, error: { message: 'lost reply' } } }
    return result
  } })
  await assert.rejects(addStudentRoster(f.api, addresses.join(' '), users), /update may already have been saved/)
  assert.equal(f.roster.size, 1005); assert.equal(f.profiles.get('0').status, 'pending')
  assert.equal(f.calls.some(c => c.table === 'profiles'), false)
  fail = false
  assert.deepEqual(await addStudentRoster(f.api, addresses.join(' '), users), { added: 1005, approved: 1, failed: 0 })
  assert.equal(f.roster.size, 1005)
})

test('an incomplete confirmation cannot start approvals', async () => {
  const users = [member(0)], f = fixture({ members: users, reply: (result, call) => call.upsert ? { data: result.data.slice(0, 199), error: null } : result })
  await assert.rejects(addStudentRoster(f.api, addresses.join(' '), users), /Could not confirm/)
  assert.equal(f.calls.length, 1); assert.equal(f.roster.size, 1005); assert.equal(f.profiles.get('0').status, 'pending')
})

test('obsolete action cannot start a roster write', async () => {
  const f = fixture()
  await assert.rejects(addStudentRoster(f.api, addresses.join(' '), [], () => false), /action stopped/)
  assert.equal(f.calls.length, 0)
})

test('page/account disposal after the roster response stops subsequent approvals', async () => {
  let live = true
  const users = [member(0)], f = fixture({ members: users, effect(call) { if (call.upsert) live = false } })
  await assert.rejects(addStudentRoster(f.api, addresses.join(' '), users, () => live), /action stopped/)
  assert.equal(f.calls.length, 1); assert.equal(f.profiles.get('0').status, 'pending')
})

test('disposal after an approval was dispatched cannot start another approval', async () => {
  let live = true
  const users = [member(0), member(1)], f = fixture({ members: users, effect(call) { if (call.update) live = false } })
  await assert.rejects(addStudentRoster(f.api, `${email(0)} ${email(1)}`, users, () => live), /action stopped/)
  assert.equal(f.profiles.get('0').status, 'approved', 'already-dispatched writes may commit')
  assert.equal(f.profiles.get('1').status, 'pending'); assert.equal(f.calls.length, 2)
})

test('a suspension applied since the pending snapshot is never overwritten', async () => {
  const f = fixture({ members: [member(0, 'suspended')] })
  assert.deepEqual(await addStudentRoster(f.api, email(0), [member(0)]), { added: 1, approved: 0, failed: 1 })
  assert.equal(f.profiles.get('0').status, 'suspended')
})

test('an already-approved member can be confirmed after a zero-row conditional update', async () => {
  const f = fixture({ members: [member(0, 'approved')] })
  assert.deepEqual(await addStudentRoster(f.api, email(0), [member(0)]), { added: 1, approved: 1, failed: 0 })
})

test('a missing member is a partial approval failure rather than blanket success', async () => {
  const f = fixture()
  assert.deepEqual(await addStudentRoster(f.api, email(0), [member(0)]), { added: 1, approved: 0, failed: 1 })
})

test('known suspended members and unlisted pending members are never targeted', async () => {
  const users = [member(0, 'suspended'), member(1)], f = fixture({ members: users })
  assert.deepEqual(await addStudentRoster(f.api, email(0), users), { added: 1, approved: 0, failed: 0 })
  assert.equal(f.calls.length, 1)
})

test('an unconfirmed member update does not prevent independent later approvals', async () => {
  const users = [member(0), member(1)], f = fixture({ members: users, reply: (result, call) => call.update && call.filters[0][1] === '0' ? { data: null, error: { message: 'lost reply' } } : result })
  assert.deepEqual(await addStudentRoster(f.api, `${email(0)} ${email(1)}`, users), { added: 2, approved: 1, failed: 1 })
})

test('disposal after zero affected rows prevents even the confirmation read', async () => {
  let live = true
  const f = fixture({ members: [member(0, 'approved')], effect(call) { if (call.update) live = false } })
  await assert.rejects(addStudentRoster(f.api, email(0), [member(0)], () => live), /action stopped/)
  assert.equal(f.calls.length, 2)
})
