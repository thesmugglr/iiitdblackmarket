import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSavedItems } from '../lib/useSavedItems'
import { CATEGORIES, CONDITIONS, TYPES } from '../lib/constants'
import Hero from '../components/Hero'
import Sections from '../components/Sections'
import ListingCard from '../components/ListingCard'
import Drawer from '../components/Drawer'
import Reveal from '../components/Reveal'
import { HowItWorks, Trust, Cta } from '../components/Landing'
import { emptyBrowse, loadBrowseListings, loadBrowseOverview, observeBrowse } from '../lib/browseState'
import type { Listing } from '../lib/types'

export default function Browse() {
  const { profile } = useAuth()
  return profile ? <AccountBrowse key={profile.id} member={profile.id} /> : null
}

function AccountBrowse({ member }: { member: string }) {
  const [{ items, state, error, overview, overviewLoading, overviewError }, setSnapshot] = useState(emptyBrowse)
  const observer = useRef<ReturnType<typeof observeBrowse> | null>(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [condition, setCondition] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('new')
  const { ids: saved, error: saveError, retry: retrySaved, toggle: toggleSaved, loading: savedLoading, pending: saving } = useSavedItems(member)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const current = observeBrowse({
      loadOverview: () => loadBrowseOverview(supabase), loadSearch: filters => loadBrowseListings(supabase, filters), publish: setSnapshot,
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer) },
    })
    observer.current = current
    return () => { current.dispose(); observer.current = null }
  }, [member])

  useEffect(() => {
    observer.current?.setFilters({ q, category, type, condition, maxPrice, sort })
  }, [q, category, type, condition, maxPrice, sort])

  const toggleSave = async (l: Listing) => {
    await toggleSaved(l.id)
  }
  const toResults = () => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const active = [type, condition, maxPrice].filter(Boolean).length + (sort !== 'new' ? 1 : 0)
  const clear = () => { setQ(''); setCategory(''); setType(''); setCondition(''); setMaxPrice(''); setSort('new') }

  return (
    <>
      <Hero q={q} setQ={setQ} category={category} setCategory={setCategory} featured={overview?.latest ?? []} onSubmit={toResults} />

      <section className="block tight" aria-label="Categories">
        <div className="cat-row">
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} className={`cat ${category === k ? 'on' : ''}`} aria-pressed={category === k} onClick={() => { setCategory(category === k ? '' : k); toResults() }}>
              <span>{v}</span><small>{overview ? `${overview.counts[k] ?? 0} listed` : overviewLoading ? 'Loading…' : 'Unavailable'}</small>
            </button>
          ))}
        </div>
        {overviewError && <p className="error small" role="alert">{overviewError} <button disabled={overviewLoading} onClick={() => void observer.current?.retryOverview()}>Retry category totals</button></p>}
      </section>

      <section className="block" id="results" aria-labelledby="fresh">
        <Sections />
        <div className="row between">
          <h2 id="fresh" className="display sm">{category ? CATEGORIES[category] : 'Fresh on campus'}</h2>
          <button onClick={() => setDrawer(true)}>Filters{active > 0 && <span className="badge unread">{active}</span>}</button>
        </div>
        {state === 'error' && <p className="error" role="alert">{error} <button onClick={() => observer.current?.retrySearch()}>Try again</button></p>}
        {saveError && <p className="error" role="alert">{saveError} <button onClick={retrySaved} disabled={savedLoading || saving.size > 0}>Reload saved items</button></p>}
        {state === 'loading' && <div className="bento" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}</div>}
        {state === 'ok' && items.length === 0 && (
          <div className="empty"><strong>Nothing matches yet</strong><span>Loosen a filter, or be the first to list it.</span><button onClick={clear}>Clear filters</button></div>
        )}
        {state === 'ok' && items.length > 0 && (
          <div className="bento">
            {items.map((l, i) => <Reveal key={l.id} className={i === 0 ? 'big' : ''} delay={Math.min(i, 5) * 0.05}><ListingCard l={l} feature={i === 0} saved={saved.has(l.id)} onSave={toggleSave} /></Reveal>)}
          </div>
        )}
      </section>

      <HowItWorks />
      <Trust />
      <Cta />

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filters and sort">
        <div className="form">
          <label>Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="">Buy, rent or free</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Condition<select value={condition} onChange={(e) => setCondition(e.target.value)}><option value="">Any condition</option>{Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Max price (₹)<input type="number" min="0" placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></label>
          <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest first</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option></select></label>
          <div className="row"><button className="primary" onClick={() => setDrawer(false)}>Show {state === 'ok' ? items.length : ''} results</button><button className="link" onClick={clear}>Reset all</button></div>
        </div>
      </Drawer>
    </>
  )
}
