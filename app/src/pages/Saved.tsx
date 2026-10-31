import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ListingCard from '../components/ListingCard'
import type { Listing } from '../lib/types'

export default function Saved() {
  const [items, setItems] = useState<Listing[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const { data, error } = await supabase.from('saved_items').select('listing:listings(*)')
        if (error) throw error
        if (!live) return
        const rows = (data ?? []) as unknown as { listing: Listing | null }[]
        setItems(rows.map(r => r.listing).filter((x): x is Listing => Boolean(x)))
      } catch {
        if (live) setError('Could not load saved items. Please try again.')
      }
    })()
    return () => { live = false }
  }, [attempt])
  if (error) return <div><h1>Saved items</h1><p className="error" role="alert">{error}</p><button onClick={() => { setError(''); setAttempt(n => n + 1) }}>Try again</button></div>
  if (!items) return <p className="muted">Loading…</p>
  return (
    <>
      <h1>Saved items</h1>
      {items.length === 0 && <p className="muted">Nothing saved yet. Tap Save on a listing to keep it here.</p>}
      <div className="grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
    </>
  )
}
