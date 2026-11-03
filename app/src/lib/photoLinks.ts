import { createLinkCache } from './signedUrlCache'
import { supabase } from './supabase'
import { requestSignedLinks } from './storageLinks'

export const LISTING_PHOTOS = 'listing-photos'
export const HOUR = 3600
const DAY = 24 * HOUR

export const signPaths = (bucket: string, paths: string[], seconds: number) => requestSignedLinks(supabase, bucket, paths, seconds)

function browserStore() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}

// Restore persisted links only after this account's approved profile is known.
// Same-account token refreshes retain both links and in-flight batching.
export const photoLinks = createLinkCache({
  sign: paths => signPaths(LISTING_PHOTOS, paths, DAY),
  lifetimeMs: DAY * 1000, renewBeforeMs: HOUR * 1000, missingMs: 10 * 60 * 1000,
  store: browserStore(), scope: null,
})

export function setPhotoLinkAccount(account: string | null) { photoLinks.setScope(account) }
export function forgetPhotoLinks() { photoLinks.setScope(null); photoLinks.clear() }
