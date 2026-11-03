import type { SupabaseClient } from '@supabase/supabase-js'
import type { Status } from './types'
import { thumbPath } from './image.ts'

type ListingApi = Pick<SupabaseClient, 'from'>

export async function updateOwnedListingStatus(api: ListingApi, id: string, owner: string, status: Exclude<Status, 'removed'>) {
  const result = await api.from('listings').update({ status }).eq('id', id).eq('seller_id', owner).select('id,seller_id,status').single()
  if (result.error || result.data?.id !== id || result.data?.seller_id !== owner || result.data?.status !== status) {
    throw new Error('Could not confirm the listing update. Refresh and try again.')
  }
}

export async function deleteOwnedListing(api: ListingApi, id: string, owner: string): Promise<string[]> {
  const result = await api.from('listings').delete().eq('id', id).eq('seller_id', owner).select('id,seller_id,photos').single()
  // RLS may return success with no affected row. Never start file cleanup from
  // the stale page record; use the photo list of the row actually deleted.
  if (result.error || result.data?.id !== id || result.data?.seller_id !== owner || !Array.isArray(result.data?.photos)) {
    throw new Error('Could not confirm deletion. No photo cleanup was started. Refresh and try again.')
  }
  return result.data.photos as string[]
}

export async function cleanupListingPhotos(api: Pick<SupabaseClient, 'storage'>, owner: string, photos: string[]) {
  // A returned row still must not cause cleanup outside this seller's folder.
  if (!owner || photos.some(p => typeof p !== 'string' || !p.startsWith(`${owner}/`) || p.split('/').length !== 2 || ['.', '..', ''].includes(p.split('/')[1]))) {
    throw new Error('The listing was deleted, but its photo paths could not be verified. No photo cleanup was started.')
  }
  if (!photos.length) return
  try {
    const paths = [...new Set(photos.flatMap(p => [p, thumbPath(p)]))]
    const result = await api.storage.from('listing-photos').remove(paths)
    // Missing objects (including legacy thumbnails) are already clean. Retrying
    // a partial removal is safe because Storage deletion is idempotent.
    if (result.error || !result.data) throw new Error('Storage cleanup failed')
  } catch {
    throw new Error('The listing was deleted, but photo cleanup could not be confirmed. Retry photo cleanup before leaving.')
  }
}
