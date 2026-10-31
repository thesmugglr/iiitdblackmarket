import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSavedItems } from '../lib/useSavedItems'
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
  const { ids: savedIds, toggle: toggleSaved, loading: savedLoading, pending: saving, error: saveError, retry: retrySaved } = useSavedItems(profile?.id)
  const saved = savedIds.has(id ?? '')
  const [msg, setMsg] = useState('')
  const [missing, setMissing] = useState(false)
  const urls = useSignedUrls('listing-photos', l?.photos ?? [])

  const load = async () => {
    const { data } = await supabase.from('listings').select('*, seller:profiles!listings_seller_id_fkey(display_name,batch)').eq('id', id!).maybeSingle()
    if (!data) return setMissing(true)
    setL(data as unknown as Listing)
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (missing) return <p>This listing is not available.</p>
  if (!l || !profile) return <p className="muted">Loading…</p>
  const mine = l.seller_id === profile.id

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: l!.title, url })
      else { await navigator.clipboard.writeText(url); setMsg('Link copied. Anyone approved on the site can open it.') }
    } catch { /* sharing cancelled */ }
  }
  const toggleSave = async () => {
    await toggleSaved(l.id)
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
  const renew = async () => {
    const { error } = await supabase.rpc('renew_listing', { p_listing: l.id })
    setMsg(error ? error.message : 'Renewed for 30 days.')
    void load()
  }
  const daysLeft = l.expires_at ? Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000) : null
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
          <button onClick={toggleSave} disabled={savedLoading || saving.has(l.id)}><Heart filled={saved} /> {saved ? 'Saved' : 'Save'}</button>
          <button onClick={share}>Share</button>
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
        {mine && daysLeft !== null && l.status !== 'sold' && (
          <p className={daysLeft <= 3 ? 'error small' : 'muted small'}>{daysLeft > 0 ? `Listing expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` : 'This listing has expired and is hidden from others.'} <button className="link" onClick={renew}>Renew for 30 days</button></p>
        )}
        {msg && <p className="muted">{msg}</p>}
        {saveError && <p className="error" role="alert">{saveError} <button onClick={retrySaved} disabled={savedLoading || saving.size > 0}>Reload saved items</button></p>}
      </div>
    </div>
  )
}
