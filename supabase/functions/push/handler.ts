// Request handling for the `push` Edge Function, kept free of Deno globals so the Node tests can run it.
//
// The database (trigger send_push, through pg_net) posts {"notification_id": ...} with an `x-push-secret` header.
// Only the database knows that secret: this function does not store it, it hands it back to push_payload() and
// push_prune(), which check it before returning anything. Calls to those use the public API key.
import { type PushSubscriptionKeys, type VapidKeys, sendWebPush } from './webpush.ts'

interface Payload { title: string; link: string | null; kind: string; subscriptions: PushSubscriptionKeys[] }

export interface HandlerDeps {
  env: (name: string) => string | undefined
  fetch: typeof fetch
  send?: (subscription: PushSubscriptionKeys, message: string, vapid: VapidKeys) => Promise<number>
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export function createHandler({ env, fetch: request, send = (s, m, v) => sendWebPush(s, m, v, request) }: HandlerDeps) {
  const setting = (name: string) => {
    const value = env(name)
    if (!value) throw new Error(`Missing function secret ${name}`)
    return value
  }
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const secret = req.headers.get('x-push-secret') ?? ''
    let id = ''
    try { id = String((await req.json())?.notification_id ?? '') } catch { /* not JSON */ }
    if (!secret || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: 'Bad request' }, 400)

    let base: string, apiKey: string, vapid: VapidKeys
    try {
      base = setting('SUPABASE_URL').replace(/\/+$/, '')
      apiKey = setting('PUSH_API_KEY')
      vapid = { publicKey: setting('VAPID_PUBLIC_KEY'), privateKey: setting('VAPID_PRIVATE_KEY'), subject: setting('VAPID_SUBJECT') }
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Push is not configured' }, 500)
    }
    const rpc = (name: string, args: unknown) => request(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })

    let answer: Response
    try { answer = await rpc('push_payload', { p_notification: id, p_secret: secret }) }
    catch { return json({ error: 'Payload service unavailable' }, 502) }
    if (!answer.ok) {
      await answer.body?.cancel()
      return json({ error: answer.status >= 500 ? 'Payload service unavailable' : 'Forbidden' }, answer.status >= 500 ? 502 : 403)
    }
    let payload: Payload | null
    try { payload = await answer.json() as Payload | null }
    catch { return json({ error: 'Invalid payload response' }, 502) }
    if (!payload) return json({ attempted: 0, sent: 0, removed: 0, failed: 0, status: 'no_notification' }) // the notification was deleted in the meantime

    const message = JSON.stringify({ title: 'The Smugglr', body: payload.title, url: payload.link ?? '', tag: payload.kind })
    const gone: string[] = []
    let sent = 0, failed = 0
    const failures: Record<string, number> = {}
    const failure = (kind: string) => { failed++; failures[kind] = (failures[kind] ?? 0) + 1 }
    await Promise.all(payload.subscriptions.map(async (subscription) => {
      try {
        const status = await send(subscription, message, vapid)
        if (status === 404 || status === 410) gone.push(subscription.endpoint)
        else if (status >= 200 && status < 300) sent++
        else failure(status === 401 || status === 403 ? 'authorization' : status === 429 ? 'rate_limited' : status >= 500 ? 'provider_unavailable' : 'provider_rejected')
      } catch { failure('transport_or_encryption') }
    }))
    let removed = 0, pruneFailed = false
    if (gone.length) {
      try {
        const pruned = await rpc('push_prune', { p_secret: secret, p_endpoints: gone })
        if (!pruned.ok) throw new Error('Prune failed')
        const count = await pruned.json()
        if (!Number.isInteger(count) || count < 0) throw new Error('Invalid prune result')
        removed = count
      } catch { pruneFailed = true }
    }
    // Counts/categories only: never expose subscription endpoints, keys or message contents.
    return json({ attempted: payload.subscriptions.length, sent, removed, failed, failures, pruneFailed,
      status: !payload.subscriptions.length ? 'no_subscriptions' : failed || pruneFailed ? 'delivery_failed' : sent ? 'provider_accepted' : 'expired_subscriptions' }, failed || pruneFailed ? 502 : 200)
  }
}
