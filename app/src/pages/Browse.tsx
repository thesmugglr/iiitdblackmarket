import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, CONDITIONS, TYPES } from '../lib/constants'
import { Search } from '../components/Icons'
import Scene from '../components/Scene'
import ListingCard from '../components/ListingCard'
import type { Listing } from '../lib/types'

export default function Browse() {
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
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, category, type, condition, maxPrice, sort])

  return (
    <>
      <Scene counts={counts} category={category} tags={latest} onPick={(k) => { setCategory(category === k ? '' : k); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
      <div className="results-bar" id="results">
        <label className="search"><Search /><input type="search" placeholder="Search cycles, books, cookers…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {category && <button onClick={() => setCategory('')}>{CATEGORIES[category]} ✕</button>}
      </div>
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Buy, rent or free</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition">
          <option value="">Any condition</option>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="number" min="0" placeholder="Max price ₹" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Maximum price" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Newest first</option>
          <option value="low">Price, low to high</option>
          <option value="high">Price, high to low</option>
        </select>
      </div>
      {state === 'loading' && <p className="muted">Loading…</p>}
      {state === 'error' && <p className="error">Could not load listings. Try again.</p>}
      {state === 'ok' && items.length === 0 && <div className="empty"><strong>Nothing here yet</strong><span>Loosen a filter, or be the first to list something.</span></div>}
      {state === 'ok' && items.length > 0 && <p className="count">{items.length} listing{items.length === 1 ? '' : 's'}</p>}
      <div className="grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
    </>
  )
}
