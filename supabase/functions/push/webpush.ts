// Web Push with only the standard Web Crypto API, so the same file runs in the Supabase Edge runtime (Deno) and in
// the Node test suite, with no third-party code:
//   * RFC 8291 / RFC 8188: the message is encrypted for the browser ("aes128gcm" content coding).
//   * RFC 8292 (VAPID): each request is signed with this site's key so push services know who is sending.

export interface PushSubscriptionKeys { endpoint: string; p256dh: string; auth: string }
export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

const text = new TextEncoder()
const RECORD_SIZE = 4096
// 4096 octets of push body, minus the 86-octet header, 16-octet tag and 1-octet padding delimiter (RFC 8291 §4).
export const MAX_PAYLOAD_BYTES = 3993

export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

// HKDF with a single expand block, exactly as the RFC 8291 §3.4 pseudocode (every output here is <= 32 octets).
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm)
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length)
}

/** A P-256 private key as a JWK, from the raw private scalar and the 65-octet uncompressed public point. */
function privateJwk(privateKey: Uint8Array, publicKey: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('Expected an uncompressed P-256 public key')
  return { kty: 'EC', crv: 'P-256', d: toBase64Url(privateKey), x: toBase64Url(publicKey.slice(1, 33)), y: toBase64Url(publicKey.slice(33, 65)), ext: true }
}

/**
 * Encrypts `payload` for one browser subscription. Tests may fix the sender key pair and salt to reproduce the
 * RFC 8291 example; real sends use a fresh key pair and random salt every time.
 */
export async function encryptPayload(
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  payload: Uint8Array,
  fixed?: { senderPrivateKey: Uint8Array; senderPublicKey: Uint8Array; salt: Uint8Array },
): Promise<Uint8Array> {
  if (payload.length > MAX_PAYLOAD_BYTES) throw new Error('Push payload too large')
  const uaPublic = fromBase64Url(subscription.p256dh)
  const authSecret = fromBase64Url(subscription.auth)
  // Importing the browser's key checks that it is a valid point on P-256 (RFC 8291 §7).
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  let senderPrivate: CryptoKey
  let senderPublic: Uint8Array
  if (fixed) {
    senderPrivate = await crypto.subtle.importKey('jwk', privateJwk(fixed.senderPrivateKey, fixed.senderPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
    senderPublic = fixed.senderPublicKey
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    senderPrivate = pair.privateKey
    senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  }
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16))

  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderPrivate, 256))
  const keyInfo = concat(text.encode('WebPush: info\0'), uaPublic, senderPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, text.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, text.encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  // A single record whose plaintext ends with the 0x02 padding delimiter (RFC 8188 §2, RFC 8291 §4).
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, concat(payload, new Uint8Array([2]))))
  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = senderPublic.length
  return concat(header, senderPublic, ciphertext)
}

/** The `Authorization` header for a push request to `endpoint` (RFC 8292), valid for 12 hours. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const publicKey = fromBase64Url(vapid.publicKey)
  const key = await crypto.subtle.importKey('jwk', privateJwk(fromBase64Url(vapid.privateKey), publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const encode = (value: unknown) => toBase64Url(text.encode(JSON.stringify(value)))
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })}`
  // Web Crypto returns ECDSA signatures as raw r||s, which is the JWS ES256 format.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text.encode(unsigned)))
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${vapid.publicKey}`
}

/** Sends one message and returns the push service's HTTP status (404 or 410 mean the subscription is gone). */
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  message: string,
  vapid: VapidKeys,
  send: typeof fetch = fetch,
): Promise<number> {
  const body = await encryptPayload(subscription, text.encode(message))
  const response = await send(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body,
  })
  await response.body?.cancel()
  return response.status
}
