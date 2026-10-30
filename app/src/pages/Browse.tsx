import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, CONDITIONS, TYPES } from '../lib/constants'
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
      <div className="browse-heading"><p className="app-eyebrow">THE CAMPUS CIRCLE</p><h1>Your campus. Your next find.</h1><p className="muted">Good stuff, from the people just a walk away.</p></div>
      <div className="filters">
        <input type="search" placeholder="What are you looking for?" aria-label="Search marketplace items" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Any type</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition">
          <option value="">Any condition</option>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="number" min="0" placeholder="Max ₹" aria-label="Maximum price in rupees" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="new">Newest</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
      </div>
      {state === 'loading' && <p className="muted">Loading…</p>}
      {state === 'error' && <p className="error">Could not load listings. Try again.</p>}
      {state === 'ok' && items.length === 0 && <p className="muted">No items match. Try different filters, or list something yourself.</p>}
      <div className="grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
    </>
  )
}
