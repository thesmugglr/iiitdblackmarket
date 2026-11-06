import type { SupabaseClient } from '@supabase/supabase-js'

// Phone and browser notifications that arrive even when the site is closed (Web Push through the service worker).
// The server side is the `push` Edge Function; see docs/push-notifications.md.

export type PushState =
  | 'unsupported'   // this browser cannot receive push messages
  | 'needs-install' // iPhone/iPad: only works from the Home Screen app
  | 'unavailable'   // the site's push sender is not set up yet
  | 'blocked'       // the person said no in the browser's permission prompt
  | 'off'
  | 'on'

type Api = Pick<SupabaseClient, 'rpc'>

const browserSupportsPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isAppleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function publicKey(api: Api): Promise<string | null> {
  const { data, error } = await api.rpc('push_public_key')
  if (error) throw error
  return typeof data === 'string' && data ? data : null
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  // The service worker is only registered in the built site (not the dev server).
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

function sameKey(subscription: PushSubscription, key: string) {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const a = new Uint8Array(current)
  const b = urlBase64ToBytes(key)
  return a.length === b.length && a.every((x, i) => x === b[i])
}

export async function pushState(api: Api): Promise<PushState> {
  if (!browserSupportsPush()) return isAppleMobile() && !isInstalled() ? 'needs-install' : 'unsupported'
  if (isAppleMobile() && !isInstalled()) return 'needs-install'
  const reg = await registration()
  if (!reg) return 'unsupported'
  if (!(await publicKey(api))) return 'unavailable'
  if (Notification.permission === 'denied') return 'blocked'
  const subscription = await reg.pushManager.getSubscription()
  return subscription && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Asks for permission, subscribes this browser and stores the subscription for the signed-in account. */
export async function enablePush(api: Api): Promise<PushState> {
  if (!browserSupportsPush()) return 'unsupported'
  const reg = await registration()
  if (!reg) return 'unsupported'
  const key = await publicKey(api)
  if (!key) return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  let subscription = await reg.pushManager.getSubscription()
  if (subscription && !sameKey(subscription, key)) { await subscription.unsubscribe(); subscription = null }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(key) })
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('This browser returned an incomplete push subscription.')
  const { error } = await api.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth })
  if (error) throw error
  return 'on'
}

/** Stops notifications on this browser: removes the stored subscription first, then the browser's own. */
export async function disablePush(api: Api): Promise<PushState> {
  if (!browserSupportsPush()) return 'unsupported'
  const subscription = await (await registration())?.pushManager.getSubscription()
  if (subscription) {
    const { error } = await api.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
    if (error) throw error
    await subscription.unsubscribe()
  }
  return 'off'
}

/** On sign-out: this browser must not keep receiving the previous account's notifications. Never throws. */
export async function forgetThisDevice(api: Api): Promise<void> {
  try {
    if (!browserSupportsPush()) return
    const subscription = await (await registration())?.pushManager.getSubscription()
    if (!subscription) return
    await api.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
    // Unsubscribe even if the server copy could not be removed: it then points nowhere and the sender prunes it.
    await subscription.unsubscribe()
  } catch { /* best effort */ }
}
