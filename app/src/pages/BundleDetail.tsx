import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ListingCard from '../components/ListingCard'
import { inr } from '../lib/constants'
import type { Bundle } from '../lib/types'

export default function BundleDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [b, setB] = useState<Bundle | null>(null)
  const [msg, setMsg] = useState('')
  const [missing, setMissing] = useState(false)
  const load = async () => {
    const { data } = await supabase.from('bundles').select('*, seller:profiles!bundles_seller_id_fkey(display_name), items:bundle_items(listing:listings(*))').eq('id', id!).maybeSingle()
    if (!data) return setMissing(true)
    setB(data as unknown as Bundle)
  }
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (missing) return <p>This bundle is not available.</p>
  if (!b || !profile) return <p className="muted">Loading…</p>
  const listings = (b.items ?? []).map((i) => i.listing).filter((l): l is NonNullable<typeof l> => Boolean(l))
  const total = listings.reduce((n, l) => n + l.price_inr, 0)
  const mine = b.seller_id === profile.id
  const chat = async () => {
    const first = listings.find((l) => l.status === 'active' || l.status === 'reserved')
    if (!first) return setMsg('These items are no longer available.')
    const { data, error } = await supabase.rpc('start_conversation', { p_listing: first.id })
    if (error) return setMsg(error.message)
    nav(`/inbox/${data}`)
  }
  const sold = async () => {
    const { error } = await supabase.rpc('mark_bundle_sold', { p_bundle: b.id })
    setMsg(error?.message ?? '')
    void load()
  }
  const remove = async () => {
    if (!confirm('Delete this bundle? Your listings stay.')) return
    await supabase.from('bundles').delete().eq('id', b.id)
    nav('/bundles')
  }
  return (
    <>
      <h1>{b.title}</h1>
      <div className="price big">{inr(b.price_inr)} {total > b.price_inr && <span className="badge">save {inr(total - b.price_inr)}</span>}{b.status !== 'active' && <span className={`badge ${b.status}`}>{b.status}</span>}</div>
      <p className="muted small">By {b.seller?.display_name}. {listings.length} items worth {inr(total)} separately.</p>
      {b.description && <p className="desc">{b.description}</p>}
      <div className="row">
        {!mine && b.status === 'active' && <button className="primary" onClick={chat}>Chat about this bundle</button>}
        {mine && b.status === 'active' && <button onClick={sold}>Mark bundle sold</button>}
        {mine && <button className="danger" onClick={remove}>Delete bundle</button>}
      </div>
      {msg && <p className="muted">{msg}</p>}
      <h2>What's included</h2>
      <div className="grid">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>
    </>
  )
}
