import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CATEGORIES, CONDITIONS, inr } from '../lib/constants'
import { useSignedUrls } from '../lib/useSignedUrls'
import { Heart } from '../components/Icons'
import { priceLabel } from '../components/ListingCard'
import type { Listing, Status } from '../lib/types'

export default function ListingDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [l, setL] = useState<Listing | null>(null)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')
  const [missing, setMissing] = useState(false)
  const urls = useSignedUrls('listing-photos', l?.photos ?? [])

  const load = async () => {
    const { data } = await supabase.from('listings').select('*, seller:profiles!listings_seller_id_fkey(display_name,batch)').eq('id', id!).maybeSingle()
    if (!data) return setMissing(true)
    setL(data as unknown as Listing)
    const s = await supabase.from('saved_items').select('listing_id').eq('listing_id', id!).maybeSingle()
    setSaved(Boolean(s.data))
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (missing) return <p>This listing is not available.</p>
  if (!l || !profile) return <p className="muted">Loading…</p>
  const mine = l.seller_id === profile.id

  const toggleSave = async () => {
    if (saved) await supabase.from('saved_items').delete().eq('listing_id', l.id).eq('user_id', profile.id)
    else await supabase.from('saved_items').insert({ listing_id: l.id, user_id: profile.id })
    setSaved(!saved)
  }
  const chat = async () => {
    const { data, error } = await supabase.rpc('start_conversation', { p_listing: l.id })
    if (error) return setMsg(error.message)
    nav(`/inbox/${data}`)
  }
  const setStatus = async (status: Status) => {
    const { error } = await supabase.from('listings').update({ status }).eq('id', l.id)
    if (error) setMsg(error.message)
    else void load()
  }
  const remove = async () => {
    if (!confirm('Delete this listing permanently?')) return
    const { error } = await supabase.from('listings').delete().eq('id', l.id)
    if (error) setMsg(error.message)
    else nav('/profile')
  }
  const report = async () => {
    const reason = prompt('Why are you reporting this listing?')
    if (!reason) return
    const { error } = await supabase.from('reports').insert({ reporter_id: profile.id, listing_id: l.id, reason })
    setMsg(error ? error.message : 'Report sent. Thank you.')
  }

  return (
    <div className="detail">
      <div className="gallery">
        {urls.length ? urls.map((u, i) => u && <img key={i} src={u} alt={`${l.title} photo ${i + 1}`} />) : <div className="thumb big"><span>No photo</span></div>}
      </div>
      <div className="info">
        <h1>{l.title}</h1>
        <div className="price big">{priceLabel(l)} {l.negotiable && <span className="badge">negotiable</span>}</div>
        <p className="muted small">
          {CATEGORIES[l.category]} · {CONDITIONS[l.condition]} · {l.listing_type}
          {l.status !== 'active' && <span className={`badge ${l.status}`}>{l.status}</span>}
        </p>
        {l.listing_type === 'rent' && (
          <p>Rental period: {l.rental_period || 'ask seller'}{l.deposit_inr ? ` · Deposit ${inr(l.deposit_inr)}` : ''}</p>
        )}
        {l.pickup_area && <p>Pickup: {l.pickup_area}</p>}
        <p className="desc">{l.description}</p>
        <p className="muted small">Listed by {l.seller?.display_name}{l.seller?.batch ? ` (${l.seller.batch})` : ''} on {new Date(l.created_at).toLocaleDateString()}</p>
        <div className="row">
          {!mine && l.status !== 'sold' && l.status !== 'removed' && <button className="primary" onClick={chat}>Chat with seller</button>}
          <button onClick={toggleSave}><Heart filled={saved} /> {saved ? 'Saved' : 'Save'}</button>
          {!mine && <button className="link" onClick={report}>Report</button>}
        </div>
        {mine && (
          <div className="row">
            <Link to={`/sell/${l.id}`} className="btn">Edit</Link>
            {l.status !== 'reserved' && <button onClick={() => setStatus('reserved')}>Mark reserved</button>}
            {l.status !== 'active' && <button onClick={() => setStatus('active')}>Mark available</button>}
            {l.status !== 'sold' && <button onClick={() => setStatus('sold')}>Mark sold</button>}
            <button className="danger" onClick={remove}>Delete</button>
          </div>
        )}
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}
