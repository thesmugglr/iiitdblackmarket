import { useEffect, useState } from 'react'
import { thumbPath } from './image'
import { HOUR, LISTING_PHOTOS, photoLinks, signPaths } from './photoLinks'

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
