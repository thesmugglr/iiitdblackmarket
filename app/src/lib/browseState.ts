import type { SupabaseClient } from '@supabase/supabase-js'
import type { Listing } from './types'
import { CATEGORIES, CONDITIONS, TYPES } from './constants.ts'

export interface BrowseFilters { q: string; category: string; type: string; condition: string; maxPrice: string; sort: string }
export interface BrowseCursor { id: string; created_at: string; price_inr: number; sort: string }
export interface BrowsePage { items: Listing[]; next: BrowseCursor | null }
export const BROWSE_PAGE_SIZE = 60
interface Overview { latest: Listing[]; counts: Record<string, number> }
export interface BrowseSnapshot {
  items: Listing[]; state: 'loading' | 'ok' | 'error'; error: string; hasMore: boolean; loadingMore: boolean; moreError: string
  overview: Overview | null; overviewLoading: boolean; overviewError: string
}
export const emptyBrowseFilters = (): BrowseFilters => ({ q: '', category: '', type: '', condition: '', maxPrice: '', sort: 'new' })
export const emptyBrowse = (): BrowseSnapshot => ({ items: [], state: 'loading', error: '', hasMore: false, loadingMore: false, moreError: '', overview: null, overviewLoading: true, overviewError: '' })
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

function validCursor(cursor: BrowseCursor, sort: string) {
  return cursor.sort === sort && typeof cursor.id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cursor.id)
    && typeof cursor.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.created_at) && Number.isFinite(Date.parse(cursor.created_at))
    && Number.isInteger(cursor.price_inr) && cursor.price_inr >= 0 && cursor.price_inr <= 2147483647
}
const sameCursor = (a: BrowseCursor, b: BrowseCursor) => a.id === b.id && a.created_at === b.created_at && a.price_inr === b.price_inr && a.sort === b.sort

export async function loadBrowsePage(api: BrowseApi, filters: BrowseFilters, after: BrowseCursor | null = null, now = new Date().toISOString()): Promise<BrowsePage> {
  const { q, category, type, condition, maxPrice, sort } = filters
  if ((category && !Object.hasOwn(CATEGORIES, category)) || (type && !Object.hasOwn(TYPES, type)) || (condition && !Object.hasOwn(CONDITIONS, condition)) || !['new', 'low', 'high'].includes(sort)) throw new BrowseFilterError('Choose valid listing filters.')
  const price = maxPrice.trim() ? Number(maxPrice) : null
  if (price !== null && (!Number.isFinite(price) || price < 0)) throw new BrowseFilterError('Enter a valid nonnegative maximum price.')
  if (after && !validCursor(after, sort)) throw new Error('Invalid listing page boundary')
  let query = api.from('listings').select('*').in('status', ['active', 'reserved']).gt('expires_at', now)
  // oxlint-disable-next-line no-control-regex -- Normalize controls before quoting a URL filter value.
  const text = q.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  let searchExpression = ''
  if (text) {
    // Quote reserved PostgREST punctuation; escape LIKE's percent/underscore
    // and backslash. The existing '*' wildcard remains supported by PostgREST.
    const value = JSON.stringify(`%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`)
    searchExpression = `title.ilike.${value},description.ilike.${value}`
  }
  let boundary = ''
  if (after) {
    // Preserve PostgreSQL's full timestamp precision; Date.toISOString() would
    // truncate microseconds and skip rows. The boundary row need not exist.
    const time = JSON.stringify(after.created_at), id = JSON.stringify(after.id)
    boundary = `created_at.lt.${time},and(created_at.eq.${time},id.lt.${id})`
    if (sort !== 'new') boundary = `price_inr.${sort === 'low' ? 'gt' : 'lt'}.${after.price_inr},and(price_inr.eq.${after.price_inr},created_at.lt.${time}),and(price_inr.eq.${after.price_inr},created_at.eq.${time},id.lt.${id})`
  }
  // Both OR groups must hold. One nested expression keeps search punctuation
  // separate from pagination even when both filters need PostgREST logic.
  if (searchExpression || boundary) query = query.or(searchExpression && boundary ? `and(or(${searchExpression}),or(${boundary}))` : searchExpression || boundary)
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('listing_type', type)
  if (condition) query = query.eq('condition', condition)
  // Listing prices are nonnegative int32 values. Floor a fractional cap and
  // clamp an oversized one instead of sending an invalid integer comparison.
  if (price !== null) query = query.lte('price_inr', Math.min(2147483647, Math.floor(price)))
  if (sort !== 'new') query = query.order('price_inr', { ascending: sort === 'low' })
  const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(BROWSE_PAGE_SIZE + 1)
  if (result.error || !Array.isArray(result.data)) throw new Error('Listing search failed')
  const items = (result.data as unknown as Listing[]).slice(0, BROWSE_PAGE_SIZE)
  let next: BrowseCursor | null = null
  if (result.data.length > BROWSE_PAGE_SIZE) {
    const last = items.at(-1)!
    next = { id: last.id, created_at: last.created_at, price_inr: last.price_inr, sort }
    if (!validCursor(next, sort) || (after && sameCursor(after, next))) throw new Error('Listing page boundary could not be confirmed')
  }
  return { items, next }
}

// Existing callers that only need the first bounded page keep the same shape.
export async function loadBrowseListings(api: BrowseApi, filters: BrowseFilters, now = new Date().toISOString()): Promise<Listing[]> {
  return (await loadBrowsePage(api, filters, null, now)).items
}

interface BrowseSource {
  loadOverview: () => Promise<Overview>
  loadPage: (filters: BrowseFilters, after: BrowseCursor | null) => Promise<BrowsePage>
  schedule: (callback: () => void, delay: number) => () => void
  publish: (snapshot: BrowseSnapshot) => void
}

// Overview and search have independent revisions; every observer belongs to
// one account. Dispose also cancels a search that has not left its debounce.
export function observeBrowse(source: BrowseSource) {
  let active = true, searchRevision = 0, overviewRevision = 0, cancelSearch = () => {}
  let filters = emptyBrowseFilters(), snapshot = emptyBrowse(), cursor: BrowseCursor | null = null
  const publish = (next: Partial<BrowseSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }; source.publish(snapshot)
  }
  const search = (next: BrowseFilters, delay: number) => {
    if (!active) return
    filters = { ...next }
    const current = ++searchRevision, request = { ...filters }
    cancelSearch()
    cursor = null
    publish({ state: 'loading', error: '', hasMore: false, loadingMore: false, moreError: '' })
    cancelSearch = source.schedule(() => {
      if (!active || current !== searchRevision) return
      void (async () => {
        try {
          const page = await source.loadPage(request, null)
          if (active && current === searchRevision) {
            cursor = page.next ? { ...page.next } : null
            publish({ items: page.items, state: 'ok', error: '', hasMore: !!cursor })
          }
        } catch (reason) {
          if (active && current === searchRevision) publish({ state: 'error', error: reason instanceof BrowseFilterError ? reason.message : "Couldn't load listings. Check your connection and try again." })
        }
      })()
    }, delay)
  }
  const loadMore = async () => {
    if (!active || snapshot.state !== 'ok' || snapshot.loadingMore || !cursor) return
    const current = searchRevision, after = { ...cursor }, request = { ...filters }
    publish({ loadingMore: true, moreError: '' })
    try {
      const page = await source.loadPage(request, after)
      if (!active || current !== searchRevision) return
      if (page.next && sameCursor(after, page.next)) throw new Error('Listing page did not advance')
      // A price/status edit between requests may move an already displayed row
      // across the boundary. Keep one card per ID and advance the raw cursor.
      const seen = new Set(snapshot.items.map(item => item.id))
      const added = page.items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true })
      cursor = page.next ? { ...page.next } : null
      publish({ items: [...snapshot.items, ...added], hasMore: !!cursor, loadingMore: false, moreError: '' })
    } catch {
      if (active && current === searchRevision) publish({ loadingMore: false, moreError: 'Could not load more listings. Your loaded results are retained; try again.' })
    }
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
    setFilters: (next: BrowseFilters) => search(next, 250), retrySearch: () => search(filters, 0), retryOverview, loadMore,
    dispose: () => { active = false; ++searchRevision; ++overviewRevision; cancelSearch() },
  }
}
