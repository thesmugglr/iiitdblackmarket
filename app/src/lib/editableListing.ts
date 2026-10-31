import type { Listing } from './types'

// UI readiness only: database policies remain the authorization boundary.
// An edit form must not accept drafts/uploads until its current record is ready.
export function observeEditableListing(
  id: string,
  ownerId: string,
  load: () => Promise<Listing | null>,
  ready: (listing: Listing) => void,
  failed: (message: string) => void,
) {
  let active = true
  void (async () => {
    try {
      const listing = await load()
      if (!active) return
      if (!listing || listing.id !== id || listing.seller_id !== ownerId || listing.status === 'removed') {
        failed('This listing is unavailable or cannot be edited by your account.')
        return
      }
      ready(listing)
    } catch {
      if (active) failed('Could not load this listing. Check your connection and try again.')
    }
  })()
  return () => { active = false }
}
