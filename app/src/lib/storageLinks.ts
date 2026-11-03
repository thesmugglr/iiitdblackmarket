import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignedLink } from './signedUrlCache.ts'

export async function requestSignedLinks(api: Pick<SupabaseClient, 'storage'>, bucket: string, paths: string[], seconds: number): Promise<SignedLink[]> {
  const { data, error } = await api.storage.from(bucket).createSignedUrls(paths, seconds)
  // A request failure is not evidence that every object is missing. Let the
  // cache retry a later request rather than remembering a false absence.
  if (error || !Array.isArray(data)) throw new Error('Could not sign photo links.')
  return data.map(d => ({ path: d.path ?? '', url: d.signedUrl ?? '' }))
}
