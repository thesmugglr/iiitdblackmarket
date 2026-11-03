import type { SupabaseClient } from '@supabase/supabase-js'
import type { Listing } from './types'
import { CATEGORIES, CONDITIONS, TYPES } from './constants.ts'

export interface BrowseFilters { q: string; category: string; type: string; condition: string; maxPrice: string; sort: string }
interface Overview { latest: Listing[]; counts: Record<string, number> }
export interface BrowseSnapshot {
  items: Listing[]; state: 'loading' | 'ok' | 'error'; error: string
  overview: Overview | null; overviewLoading: boolean; overviewError: string
}
export const emptyBrowseFilters = (): BrowseFilters => ({ q: '', category: '', type: '', condition: '', maxPrice: '', sort: 'new' })
export const emptyBrowse = (): BrowseSnapshot => ({ items: [], state: 'loading', error: '', overview: null, overviewLoading: true, overviewError: '' })
export class BrowseFilterError extends Error {}
type BrowseApi = Pick<SupabaseClient, 'from'>

export async function loadBrowseOverview(api: BrowseApi, now = new Date().toISOString()): Promise<Overview> {
  const live = () => api.from('listings').select('id', { count: 'exact', head: true }).in('status', ['active', 'reserved']).gt('expires_at', now)
  const [latest, counts] = await Promise.all([
    api.from('listings').select('*').in('status', ['active', 'reserved']).gt('expires_at', now)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(3),
    Promise.all(Object.keys(CATEGORIES).map(async category => {
      const result = await live().eq('category', category)
      if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error('Category count unavailable')
      return [category, result.count] as const
    })),
  ])
  if (latest.error || !Array.isArray(latest.data)) throw new Error('Featured listings unavailable')
  return { latest: latest.data as unknown as Listing[], counts: Object.fromEntries(counts) }
}

export async function loadBrowseListings(api: BrowseApi, filters: BrowseFilters, now = new Date().toISOString()): Promise<Listing[]> {
  const { q, category, type, condition, maxPrice, sort } = filters
  if ((category && !Object.hasOwn(CATEGORIES, category)) || (type && !Object.hasOwn(TYPES, type)) || (condition && !Object.hasOwn(CONDITIONS, condition)) || !['new', 'low', 'high'].includes(sort)) throw new BrowseFilterError('Choose valid listing filters.')
  const price = maxPrice.trim() ? Number(maxPrice) : null
  if (price !== null && (!Number.isFinite(price) || price < 0)) throw new BrowseFilterError('Enter a valid nonnegative maximum price.')
  let query = api.from('listings').select('*').in('status', ['active', 'reserved']).gt('expires_at', now)
  // oxlint-disable-next-line no-control-regex -- Normalize controls before quoting a URL filter value.
  const text = q.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (text) {
    // Quote reserved PostgREST punctuation; escape LIKE's percent/underscore
    // and backslash. The existing '*' wildcard remains supported by PostgREST.
    const value = JSON.stringify(`%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`)
    query = query.or(`title.ilike.${value},description.ilike.${value}`)
  }
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('listing_type', type)
  if (condition) query = query.eq('condition', condition)
  // Listing prices are nonnegative int32 values. Floor a fractional cap and
  // clamp an oversized one instead of sending an invalid integer comparison.
  if (price !== null) query = query.lte('price_inr', Math.min(2147483647, Math.floor(price)))
  if (sort !== 'new') query = query.order('price_inr', { ascending: sort === 'low' })
  const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(60)
  if (result.error || !Array.isArray(result.data)) throw new Error('Listing search failed')
  return result.data as unknown as Listing[]
}

interface BrowseSource {
  loadOverview: () => Promise<Overview>
  loadSearch: (filters: BrowseFilters) => Promise<Listing[]>
  schedule: (callback: () => void, delay: number) => () => void
  publish: (snapshot: BrowseSnapshot) => void
}

// Overview and search have independent revisions; every observer belongs to
// one account. Dispose also cancels a search that has not left its debounce.
export function observeBrowse(source: BrowseSource) {
  let active = true, searchRevision = 0, overviewRevision = 0, cancelSearch = () => {}
  let filters = emptyBrowseFilters(), snapshot = emptyBrowse()
  const publish = (next: Partial<BrowseSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }; source.publish(snapshot)
  }
  const search = (next: BrowseFilters, delay: number) => {
    if (!active) return
    filters = { ...next }
    const current = ++searchRevision, request = { ...filters }
    cancelSearch()
    publish({ state: 'loading', error: '' })
    cancelSearch = source.schedule(() => {
      if (!active || current !== searchRevision) return
      void (async () => {
        try {
          const items = await source.loadSearch(request)
          if (active && current === searchRevision) publish({ items, state: 'ok', error: '' })
        } catch (reason) {
          if (active && current === searchRevision) publish({ state: 'error', error: reason instanceof BrowseFilterError ? reason.message : "Couldn't load listings. Check your connection and try again." })
        }
      })()
    }, delay)
  }
  const retryOverview = async () => {
    if (!active) return
    const current = ++overviewRevision
    publish({ overviewLoading: true, overviewError: '' })
    try {
      const overview = await source.loadOverview()
      if (active && current === overviewRevision) publish({ overview, overviewLoading: false, overviewError: '' })
    } catch {
      if (active && current === overviewRevision) publish({ overviewLoading: false, overviewError: 'Could not refresh category totals and featured listings. Please try again.' })
    }
  }
  void retryOverview()
  return {
    setFilters: (next: BrowseFilters) => search(next, 250), retrySearch: () => search(filters, 0), retryOverview,
    dispose: () => { active = false; ++searchRevision; ++overviewRevision; cancelSearch() },
  }
}
