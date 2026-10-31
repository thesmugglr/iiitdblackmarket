import { useEffect, useState } from 'react'
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
import type { Listing } from '../lib/types'

export default function Browse() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Listing[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [condition, setCondition] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('new')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [latest, setLatest] = useState<Listing[]>([])
  const { ids: saved, error: saveError, retry: retrySaved, toggle: toggleSaved, loading: savedLoading, pending: saving } = useSavedItems(profile?.id)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    supabase.from('listings').select('*').in('status', ['active', 'reserved']).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        const rows = (data ?? []) as Listing[]
        const m: Record<string, number> = {}
        for (const r of rows) m[r.category] = (m[r.category] ?? 0) + 1
        setCounts(m)
        setLatest(rows)
      })
  }, [])

  useEffect(() => {
    let live = true
    setState('loading')
    const t = setTimeout(async () => {
      let query = supabase.from('listings').select('*').in('status', ['active', 'reserved'])
      if (q.trim()) {
        const s = q.trim().replace(/[%,()]/g, ' ')
        query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
      }
      if (category) query = query.eq('category', category)
      if (type) query = query.eq('listing_type', type)
      if (condition) query = query.eq('condition', condition)
      if (maxPrice) query = query.lte('price_inr', Number(maxPrice))
      query = sort === 'new' ? query.order('created_at', { ascending: false }) : query.order('price_inr', { ascending: sort === 'low' })
      const { data, error } = await query.limit(60)
      if (!live) return
      if (error) return setState('error')
      setItems((data ?? []) as Listing[])
      setState('ok')
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q, category, type, condition, maxPrice, sort])

  const toggleSave = async (l: Listing) => {
    await toggleSaved(l.id)
  }
  const toResults = () => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const active = [type, condition, maxPrice].filter(Boolean).length + (sort !== 'new' ? 1 : 0)
  const clear = () => { setQ(''); setCategory(''); setType(''); setCondition(''); setMaxPrice(''); setSort('new') }

  return (
    <>
      <Hero q={q} setQ={setQ} category={category} setCategory={setCategory} featured={latest} onSubmit={toResults} />

      <section className="block tight" aria-label="Categories">
        <div className="cat-row">
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} className={`cat ${category === k ? 'on' : ''}`} aria-pressed={category === k} onClick={() => { setCategory(category === k ? '' : k); toResults() }}>
              <span>{v}</span><small>{counts[k] ?? 0} listed</small>
            </button>
          ))}
        </div>
      </section>

      <section className="block" id="results" aria-labelledby="fresh">
        <Sections />
        <div className="row between">
          <h2 id="fresh" className="display sm">{category ? CATEGORIES[category] : 'Fresh on campus'}</h2>
          <button onClick={() => setDrawer(true)}>Filters{active > 0 && <span className="badge unread">{active}</span>}</button>
        </div>
        {state === 'error' && <p className="error">Couldn't load listings. Check your connection and try again.</p>}
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
