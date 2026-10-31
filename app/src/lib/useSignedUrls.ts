import { useEffect, useState } from 'react'
import { thumbPath } from './image'
import { createLinkCache } from './signedUrlCache'
import { supabase } from './supabase'

const LISTING_PHOTOS = 'listing-photos'
const HOUR = 3600
const DAY = 24 * HOUR

async function signPaths(bucket: string, paths: string[], seconds: number) {
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds)
  return (data ?? []).map((d) => ({ path: d.path ?? '', url: d.signedUrl ?? '' }))
}

function browserStore() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}

// Listing photos can be read by every approved student, so their links are shared between screens and kept for the
// day: the browser then reuses the picture it already has instead of downloading it again (free-plan bandwidth is
// small). Chat photos belong to one conversation, so those links are signed fresh for an hour and never kept.
const photoLinks = createLinkCache({
  sign: (paths) => signPaths(LISTING_PHOTOS, paths, DAY),
  lifetimeMs: DAY * 1000,
  renewBeforeMs: HOUR * 1000,
  missingMs: 10 * 60 * 1000,
  store: browserStore(),
})

/** Call on sign-out so the next person on this browser starts with no remembered links. */
export function forgetPhotoLinks() { photoLinks.clear() }

/** Resolve private-bucket object paths to short-lived signed URLs. */
export function useSignedUrls(bucket: string, paths: string[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  const key = paths.join('|')
  useEffect(() => {
    let live = true
    if (!paths.length) {
      setUrls([])
      return
    }
    const ready = bucket === LISTING_PHOTOS
      ? photoLinks.links(paths)
      : signPaths(bucket, paths, HOUR).then((signed) => {
          const byPath = new Map(signed.map((s) => [s.path, s.url]))
          return paths.map((p) => byPath.get(p) ?? '')
        })
    ready.then((list) => { if (live) setUrls(list) }).catch(() => { /* no links: callers show the "No photo" state */ })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key])
  return urls
}

/** Small pictures for grids and previews: the thumbnail when there is one, otherwise the full-size photo. */
export function usePhotoThumbs(paths: string[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  const key = paths.join('|')
  useEffect(() => {
    let live = true
    if (!paths.length) {
      setUrls([])
      return
    }
    Promise.all([photoLinks.links(paths.map(thumbPath)), photoLinks.links(paths)])
      .then(([small, full]) => { if (live) setUrls(paths.map((_, i) => small[i] || full[i] || '')) })
      .catch(() => { /* no links: callers show the "No photo" state */ })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls
}
