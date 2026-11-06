import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deleteMyAccount, ownPhotoPaths } from '../src/lib/accountDeletion.ts'

// A fake Supabase client that records every call in order.
function fakeApi({ files = [], removeError = null, rpcError = null } = {}) {
  const calls = []
  const api = {
    storage: {
      from: (bucket) => ({
        list: async (folder, { limit, offset }) => {
          calls.push(['list', bucket, folder, offset])
          return { data: files.slice(offset, offset + limit), error: null }
        },
        remove: async (paths) => { calls.push(['remove', bucket, paths.length]); return { data: [], error: removeError } },
      }),
    },
    rpc: async (name) => { calls.push(['rpc', name]); return { data: null, error: rpcError } },
    auth: { signOut: async (options) => { calls.push(['signOut', options.scope]); return { error: null } } },
  }
  return { api, calls }
}

const uid = 'user-1'
const manyFiles = Array.from({ length: 230 }, (_, i) => ({ id: `f${i}`, name: `${i}.jpg` }))

test('lists every own photo across pages and skips folder entries', async () => {
  const { api, calls } = fakeApi({ files: [...manyFiles, { id: null, name: 'subfolder' }] })
  const paths = await ownPhotoPaths(api, uid)
  assert.equal(paths.length, 230)
  assert.equal(paths[0], 'user-1/0.jpg')
  assert.deepEqual(calls.map((c) => c[3]), [0, 100, 200])
})

test('removes photos in batches, then deletes the account, then clears only this browser session', async () => {
  const { api, calls } = fakeApi({ files: manyFiles })
  const steps = []
  await deleteMyAccount(api, uid, (s) => steps.push(s))
  assert.deepEqual(calls.filter((c) => c[0] !== 'list'), [
    ['remove', 'listing-photos', 100], ['remove', 'listing-photos', 100], ['remove', 'listing-photos', 30],
    ['rpc', 'delete_my_account'], ['signOut', 'local'],
  ])
  assert.deepEqual(steps, ['Removing your photos…', 'Deleting your account…'])
})

test('a failed photo removal stops before the account is touched', async () => {
  const { api, calls } = fakeApi({ files: manyFiles, removeError: { message: 'offline' } })
  await assert.rejects(deleteMyAccount(api, uid), /Nothing else was deleted/)
  assert.ok(!calls.some((c) => c[0] === 'rpc' || c[0] === 'signOut'))
})

test('a failed account deletion keeps the person signed in so they can retry', async () => {
  const { api, calls } = fakeApi({ rpcError: { message: 'network' } })
  await assert.rejects(deleteMyAccount(api, uid), /Could not delete your account/)
  assert.ok(!calls.some((c) => c[0] === 'signOut'))
})
