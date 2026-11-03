import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoClient } from '../src/lib/demo.ts'
import { loadAdminData } from '../src/lib/adminData.ts'

test('the production administrator loader can finish against the fictional preview adapter', { timeout: 2000 }, async () => {
  const { data: session } = await demoClient.auth.getSession()
  const { data: profile } = await demoClient.rpc('my_profile').maybeSingle()
  assert.equal(session.session.user.id, profile.id)
  assert.match(profile.id, /^[0-9a-f-]{36}$/)
  const result = await loadAdminData(demoClient, profile.id)
  assert.deepEqual(result.users.map(user => user.display_name), ['Aarav Mehta', 'Ishita Rao', 'Kabir Nair'])
  assert.equal(result.reports.length, 1)
  assert.equal(result.reports[0].status, 'open')
  assert.equal(result.reports[0].reporter.display_name, 'Kabir Nair')
})

test('preview profile/report filtering and empty keyset continuation do not mutate the fixtures', async () => {
  const result = await demoClient.rpc('admin_profiles').order('created_at', { ascending: false }).limit(1)
  assert.equal(result.data.length, 1)
  const first = result.data[0]
  const later = await demoClient.rpc('admin_profiles').order('created_at', { ascending: false }).or(`created_at.lt."${first.created_at}",and(created_at.eq."${first.created_at}",id.lt.${first.id})`)
  assert.equal(later.data.length, 2)
  const filtered = await demoClient.from('reports').eq('status', 'resolved')
  assert.deepEqual(filtered.data, [])
  assert.equal((await demoClient.from('reports').eq('status', 'open')).data.length, 1)
  assert.equal((await demoClient.rpc('admin_profiles')).data.length, 3)
})

test('fictional account relationships remain consistent across the existing preview screens', async () => {
  const profile = (await demoClient.rpc('my_profile').maybeSingle()).data
  const conversation = (await demoClient.from('conversations')).data[0]
  const messages = (await demoClient.from('messages')).data
  const wanted = (await demoClient.from('wanted_posts')).data
  assert.equal(conversation.buyer_id, profile.id)
  assert.equal(messages[0].sender_id, profile.id)
  assert.equal(messages[1].sender_id, conversation.seller_id)
  assert.equal(wanted[1].user_id, profile.id)
})
