import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PAYLOAD_BYTES, encryptPayload, fromBase64Url, sendWebPush, toBase64Url, vapidAuthorization } from '../../supabase/functions/push/webpush.ts'

const text = new TextEncoder()

// RFC 8291 section 5 and appendix A: the published example message.
const rfc = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  result: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

// A receiver-side decryption written straight from RFC 8291 §3.4, independent of the sender code.
async function decrypt(body, uaPrivate, uaPublic, authSecret) {
  const salt = body.slice(0, 16)
  const idLength = body[20]
  const asPublic = body.slice(21, 21 + idLength)
  const ciphertext = body.slice(21 + idLength)
  const jwk = { kty: 'EC', crv: 'P-256', d: toBase64Url(uaPrivate), x: toBase64Url(uaPublic.slice(1, 33)), y: toBase64Url(uaPublic.slice(33)), ext: true }
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const pub = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256))
  const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data))
  const join = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o }
  const one = new Uint8Array([1])
  const ikm = await hmac(await hmac(authSecret, secret), join(text.encode('WebPush: info\0'), uaPublic, asPublic, one))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, join(text.encode('Content-Encoding: aes128gcm\0'), one))).slice(0, 16)
  const nonce = (await hmac(prk, join(text.encode('Content-Encoding: nonce\0'), one))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ciphertext))
  assert.equal(padded.at(-1), 2, 'padding delimiter')
  return new TextDecoder().decode(padded.slice(0, -1))
}

test('reproduces the RFC 8291 example message byte for byte', async () => {
  const body = await encryptPayload({ p256dh: rfc.uaPublic, auth: rfc.auth }, text.encode(rfc.plaintext), {
    senderPrivateKey: fromBase64Url(rfc.asPrivate), senderPublicKey: fromBase64Url(rfc.asPublic), salt: fromBase64Url(rfc.salt),
  })
  assert.equal(toBase64Url(body), rfc.result)
  assert.equal(await decrypt(body, fromBase64Url(rfc.uaPrivate), fromBase64Url(rfc.uaPublic), fromBase64Url(rfc.auth)), rfc.plaintext)
})

test('a real send uses a fresh key and salt each time, and the browser can read it', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const uaPrivate = fromBase64Url((await crypto.subtle.exportKey('jwk', pair.privateKey)).d)
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const subscription = { p256dh: toBase64Url(uaPublic), auth: toBase64Url(auth) }
  const message = JSON.stringify({ title: 'IIITD Black Market', body: 'New message about Kettle ₹350', url: '/inbox/1' })
  const first = await encryptPayload(subscription, text.encode(message))
  const second = await encryptPayload(subscription, text.encode(message))
  assert.notDeepEqual(first.slice(0, 16), second.slice(0, 16), 'salt')
  assert.notDeepEqual(first.slice(21, 86), second.slice(21, 86), 'sender key')
  assert.equal(new DataView(first.buffer).getUint32(16), 4096)
  assert.equal(await decrypt(first, uaPrivate, uaPublic, auth), message)
  await assert.rejects(encryptPayload(subscription, new Uint8Array(MAX_PAYLOAD_BYTES + 1)), /too large/)
  await assert.rejects(encryptPayload({ p256dh: toBase64Url(new Uint8Array(65).fill(4)), auth: subscription.auth }, text.encode('x')))
})

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return {
    pair,
    keys: {
      publicKey: toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
      privateKey: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d,
      subject: 'https://abhikrao.github.io/iiitd-black-market/',
    },
  }
}

test('the VAPID header is a valid ES256 token for the push service origin, good for 12 hours', async () => {
  const { pair, keys } = await vapidKeys()
  const now = Date.UTC(2026, 10, 6, 12, 0, 0)
  const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc:def', keys, now)
  const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)
  assert.equal(k, keys.publicKey)
  const [h, c, s] = token.split('.')
  const decode = (part) => JSON.parse(new TextDecoder().decode(fromBase64Url(part)))
  assert.deepEqual(decode(h), { typ: 'JWT', alg: 'ES256' })
  assert.deepEqual(decode(c), { aud: 'https://fcm.googleapis.com', exp: now / 1000 + 43200, sub: keys.subject })
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromBase64Url(s), text.encode(`${h}.${c}`))
  assert.equal(ok, true)
})

test('sendWebPush posts an encrypted body with the Web Push headers and reports the status', async () => {
  const { keys } = await vapidKeys()
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const subscription = {
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    p256dh: toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  }
  let seen
  const fakeFetch = async (url, init) => { seen = { url, init }; return new Response(null, { status: 201 }) }
  assert.equal(await sendWebPush(subscription, 'hello', keys, fakeFetch), 201)
  assert.equal(seen.url, subscription.endpoint)
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm')
  assert.equal(seen.init.headers.TTL, '86400')
  assert.match(seen.init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
  assert.equal(seen.init.body.length, 86 + 'hello'.length + 1 + 16)
})
