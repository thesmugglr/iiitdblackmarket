import type { Listing } from './types'

export interface ListingSnapshot {
  listing: Listing | null
  loading: boolean
  error: string
}

export const emptyListing = (): ListingSnapshot => ({ listing: null, loading: true, error: '' })

// One observer belongs to one route/account/load attempt. Authorization remains
// in database policies; cancellation only prevents obsolete UI results.
export function observeListing(
  id: string,
  load: () => Promise<Listing | null>,
  publish: (snapshot: ListingSnapshot) => void,
) {
  let active = true
  publish(emptyListing())
  void (async () => {
    try {
      const listing = id ? await load() : null
      if (!active) return
      if (listing && listing.id !== id) throw new Error('Mismatched listing response')
      publish({ listing, loading: false, error: '' })
    } catch {
      if (active) publish({ listing: null, loading: false, error: 'Could not load this listing. Check your connection and try again.' })
    }
  })()
  return () => { active = false }
}
