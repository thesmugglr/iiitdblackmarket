import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../../supabase/functions/push/handler.ts'

const env = {
  SUPABASE_URL: 'https://example.supabase.co/', PUSH_API_KEY: 'sb_publishable_example',
  VAPID_PUBLIC_KEY: 'BPUBLIC', VAPID_PRIVATE_KEY: 'PRIVATE', VAPID_SUBJECT: 'https://example.test/',
}
const notification = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const post = (body, secret = 'db-secret') => new Request('https://example.supabase.co/functions/v1/push', {
  method: 'POST', headers: secret ? { 'x-push-secret': secret, 'Content-Type': 'application/json' } : {}, body: JSON.stringify(body),
})

function harness({ payload = null, payloadStatus = 200, statuses = {}, settings = env } = {}) {
  const rpcs = []
  const sends = []
  const fetch = async (url, init) => {
    rpcs.push({ url, init, args: JSON.parse(init.body) })
    if (url.endsWith('/push_payload')) return new Response(JSON.stringify(payload), { status: payloadStatus })
    return new Response('1', { status: 200 })
  }
  const send = async (subscription, message, vapid) => {
    sends.push({ subscription, message: JSON.parse(message), vapid })
    const status = statuses[subscription.endpoint]
    if (status instanceof Error) throw status
    return status ?? 201
  }
  return { rpcs, sends, handle: createHandler({ env: (n) => settings[n], fetch, send }) }
}

test('rejects anything but a POST with a secret and a notification id', async () => {
  const { handle, rpcs } = harness()
  assert.equal((await handle(new Request('https://x.test/', { method: 'GET' }))).status, 405)
  assert.equal((await handle(post({ notification_id: notification }, ''))).status, 400)
  assert.equal((await handle(post({ notification_id: 'not-a-uuid' }))).status, 400)
  assert.equal(rpcs.length, 0)
})

test('a wrong secret (refused by the database) sends nothing', async () => {
  const { handle, sends, rpcs } = harness({ payloadStatus: 400 })
  const res = await handle(post({ notification_id: notification }, 'guess'))
  assert.equal(res.status, 403)
  assert.equal(sends.length, 0)
  assert.deepEqual(rpcs[0].args, { p_notification: notification, p_secret: 'guess' })
  assert.equal(rpcs[0].url, 'https://example.supabase.co/rest/v1/rpc/push_payload')
  assert.deepEqual(rpcs[0].init.headers, { apikey: 'sb_publishable_example', 'Content-Type': 'application/json' })
})

test('delivers to every subscription, prunes the ones that are gone and keeps going after a failure', async () => {
  const subscriptions = ['https://a.test/1', 'https://b.test/2', 'https://c.test/3'].map((endpoint) => ({ endpoint, p256dh: 'k', auth: 'a' }))
  const { handle, sends, rpcs } = harness({
    payload: { title: 'New message about Kettle', link: '/inbox/9', kind: 'message', subscriptions },
    statuses: { 'https://b.test/2': 410, 'https://c.test/3': new Error('network') },
  })
  const res = await handle(post({ notification_id: notification }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { sent: 1, removed: 1 })
  assert.equal(sends.length, 3)
  assert.deepEqual(sends[0].message, { title: 'IIITD Black Market', body: 'New message about Kettle', url: '/inbox/9', tag: 'message' })
  assert.deepEqual(sends[0].vapid, { publicKey: 'BPUBLIC', privateKey: 'PRIVATE', subject: 'https://example.test/' })
  const prune = rpcs.find((r) => r.url.endsWith('/push_prune'))
  assert.deepEqual(prune.args, { p_secret: 'db-secret', p_endpoints: ['https://b.test/2'] })
})

test('a deleted notification is a no-op, and missing function secrets are reported', async () => {
  assert.deepEqual(await (await harness({ payload: null }).handle(post({ notification_id: notification }))).json(), { sent: 0, removed: 0 })
  const { VAPID_PRIVATE_KEY: _, ...partial } = env
  const res = await harness({ settings: partial }).handle(post({ notification_id: notification }))
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /VAPID_PRIVATE_KEY/)
})
