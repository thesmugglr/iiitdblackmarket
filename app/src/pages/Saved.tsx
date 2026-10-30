import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ListingCard from '../components/ListingCard'
import type { Listing } from '../lib/types'

export default function Saved() {
  const [items, setItems] = useState<Listing[] | null>(null)
  useEffect(() => {
    supabase.from('saved_items').select('listing:listings(*)').then(({ data }) => {
      const rows = (data ?? []) as unknown as { listing: Listing | null }[]
      setItems(rows.map((r) => r.listing).filter((x): x is Listing => Boolean(x)))
    })
  }, [])
  if (!items) return <p className="muted">Loading…</p>
  return (
    <>
      <h1>Saved items</h1>
      {items.length === 0 && <p className="muted">Nothing saved yet. Tap Save on a listing to keep it here.</p>}
      <div className="grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
    </>
  )
}
