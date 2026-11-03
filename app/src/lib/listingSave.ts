import type { SupabaseClient } from '@supabase/supabase-js'

export interface ListingDraft {
  title: string; description: string; listing_type: string; category: string; condition: string
  negotiable: boolean; price_inr: number; pickup_area: string | null; rental_period: string | null; deposit_inr: number | null; photos: string[]
}
export interface ListingSaveRequest { id: string; create: boolean; row: ListingDraft }
const fields = ['title', 'description', 'listing_type', 'category', 'condition', 'negotiable', 'price_inr', 'pickup_area', 'rental_period', 'deposit_inr'] as const
const selection = `id,seller_id,status,${fields.join(',')},photos`
const sameDraft = (a: ListingDraft, b: ListingDraft) => fields.every(key => a[key] === b[key]) && Array.isArray(a.photos) && a.photos.length === b.photos.length && a.photos.every((path, index) => path === b.photos[index])
export class ListingWriteRejected extends Error {}

export async function writeListingDraft(api: Pick<SupabaseClient, 'from'>, owner: string, request: ListingSaveRequest) {
  const { id, create, row } = request
  if (!owner || !id) throw new Error('Missing listing identity')
  let confirmed
  if (create) {
    // Retry a committed creation without overwriting a UUID collision.
    const result = await api.from('listings').upsert({ ...row, id, seller_id: owner }, { onConflict: 'id', ignoreDuplicates: true })
    if (result.error) {
      // Only an explicit SQL error proves this attempt rolled back. Transport
      // errors (including error objects returned by fetch) remain uncertain.
      if (/^[0-9A-Z]{5}$/.test(result.error.code ?? '')) throw new ListingWriteRejected('Listing creation was rejected')
      throw new Error('Listing creation failed')
    }
    confirmed = await api.from('listings').select(selection).eq('id', id).eq('seller_id', owner).single()
  } else {
    confirmed = await api.from('listings').update(row).eq('id', id).eq('seller_id', owner).neq('status', 'removed').select(selection).single()
  }
  const listing = confirmed.data as unknown as (ListingDraft & { id: string; seller_id: string; status: string }) | null
  if (confirmed.error || listing?.id !== id || listing?.seller_id !== owner || !['active', 'reserved', 'sold'].includes(listing.status) || !sameDraft(listing, row)) throw new Error('Listing save could not be confirmed')
}

interface SaveSource {
  id?: string
  newId: () => string
  write: (request: ListingSaveRequest) => Promise<void>
  cleanup: (row: ListingDraft, canClean: (path: string) => boolean) => Promise<void>
  saved: (id: string) => void
  publish: (state: { busy: boolean; error: string }) => void
}

export function observeListingSave(source: SaveSource) {
  let active = true, busy = false, id = source.id, created = !!source.id
  let original: ListingDraft | null = null, uncertainCreation = false
  const protectedPhotos = new Set<string>()
  const canClean = (path: string) => !protectedPhotos.has(path)
  const save = async (draft: ListingDraft) => {
    if (!active || busy) return
    busy = true
    source.publish({ busy: true, error: '' })
    const row = { ...draft, photos: [...draft.photos] }
    let confirmed = false, freshlyCreated = false, error = ''
    try {
      id ??= source.newId()
      // Protect BEFORE any write: a late/lost reply cannot prove rollback.
      for (const path of row.photos) protectedPhotos.add(path)
      if (!created) {
        original ??= row
        await source.write({ id, create: true, row: original })
        created = true
        freshlyCreated = true
        if (!active) return
      }
      // If a failed creation was edited, confirm its ORIGINAL request first,
      // then save the newer draft as an owned update of that same listing.
      if (!freshlyCreated || !sameDraft(original!, row)) {
        await source.write({ id, create: false, row })
        if (!active) return
      }
      confirmed = true
      await source.cleanup(row, canClean)
      if (active) source.saved(id)
    } catch (reason) {
      if (!created && original) {
        if (reason instanceof ListingWriteRejected && !uncertainCreation) original = null
        else uncertainCreation = true
      }
      error = confirmed
        ? 'The listing was saved, but removed photo cleanup could not be confirmed. Retry saving before leaving.'
        : 'Could not confirm saving the listing. Your entries are retained; retry before leaving.'
    } finally {
      busy = false
      if (active) source.publish({ busy: false, error })
    }
  }
  return { save, canClean, isActive: () => active, isBusy: () => busy, dispose: () => { active = false } }
}
