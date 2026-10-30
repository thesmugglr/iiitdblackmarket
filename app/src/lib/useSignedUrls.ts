import { useEffect, useState } from 'react'
import { supabase } from './supabase'

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
    supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!live) return
        const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
        setUrls(paths.map((p) => byPath.get(p) ?? ''))
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key])
  return urls
}
