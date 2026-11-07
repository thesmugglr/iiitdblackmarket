import { useEffect, useRef, useState } from 'react'
import AdminRemove from '../components/AdminRemove'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSavedItems } from '../lib/useSavedItems'
import { emptyListing, observeListing } from '../lib/listingState'
import { CATEGORIES, CONDITIONS, inr } from '../lib/constants'
import { cleanupListingPhotos, deleteOwnedListing, updateOwnedListingStatus } from '../lib/listingActions'
import { useSignedUrls } from '../lib/useSignedUrls'
import { Heart } from '../components/Icons'
import { priceLabel } from '../components/ListingCard'
import type { Listing } from '../lib/types'

export default function ListingDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  return <ListingDetailPage key={`${profile?.id}:${id}`} id={id ?? ''} />
}

function ListingDetailPage({ id }: { id: string }) {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [{ listing: l, loading, error }, setSnapshot] = useState(emptyListing)
  const [attempt, setAttempt] = useState(0)
  const [viewedAt] = useState(() => Date.now())
  const { ids: savedIds, toggle: toggleSaved, loading: savedLoading, pending: saving, error: saveError, retry: retrySaved } = useSavedItems(profile?.id)
  const saved = savedIds.has(id ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletedPhotos, setDeletedPhotos] = useState<string[] | null>(null)
  const actionLock = useRef(false)
  const active = useRef(false)
  const urls = useSignedUrls('listing-photos', l?.photos ?? [])

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const load = () => setAttempt((value) => value + 1)
  useEffect(() => observeListing(id, async () => {
    const { data, error } = await supabase.from('listings').select('*, seller:profiles!listings_seller_id_fkey(display_name,batch)').eq('id', id).maybeSingle()
    if (error) throw error
    return data as unknown as Listing | null
  }, setSnapshot), [id, attempt])

  // How many buyers said this seller's deals went smoothly.
  const [smooth, setSmooth] = useState(0)
  const sellerId = l?.seller_id
  useEffect(() => {
    if (!sellerId) return
    let live = true
    void supabase.rpc('smooth_deals', { p_seller: sellerId })
      .then(({ data }) => { if (live) setSmooth(typeof data === 'number' ? data : 0) })
    return () => { live = false }
  }, [sellerId])

  const runOwnerAction = async (action: () => Promise<void>) => {
    if (actionLock.current || !active.current) return
    actionLock.current = true
    setBusy(true)
    setMsg('')
    try { await action() }
    catch (error) {
      if (active.current) setMsg(error instanceof Error ? error.message : 'Could not confirm this action. Refresh and try again.')
    } finally {
      actionLock.current = false
      if (active.current) setBusy(false)
    }
  }
  if (!profile) return <p className="muted" role="status">Loading…</p>
  const cleanDeletedPhotos = async (photos: string[]) => {
    await cleanupListingPhotos(supabase, profile.id, photos)
    if (active.current) nav('/profile')
  }
  if (deletedPhotos !== null) return <div>
    <p role="status">{msg || 'Listing deleted. Removing photos…'}</p>
    <button disabled={busy} onClick={() => void runOwnerAction(() => cleanDeletedPhotos(deletedPhotos))}>Retry photo cleanup</button>{' '}
    <Link to="/profile">Back to profile</Link>
  </div>
  if (loading) return <p className="muted" role="status">Loading…</p>
  if (error) return <p className="error" role="alert">{error} <button onClick={load}>Retry</button></p>
  if (!l) return <p>This listing is not available.</p>
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
  const setStatus = (status: 'active' | 'reserved' | 'sold') => runOwnerAction(async () => {
    await updateOwnedListingStatus(supabase, l.id, profile.id, status)
    if (active.current) load()
  })
  const renew = () => runOwnerAction(async () => {
    const { error } = await supabase.rpc('renew_listing', { p_listing: l.id })
    if (error) throw new Error(error.message)
    // The RPC raises if no owned active/reserved listing was renewed.
    if (active.current) { setMsg('Renewed for 30 days.'); load() }
  })
  const daysLeft = l.expires_at ? Math.ceil((new Date(l.expires_at).getTime() - viewedAt) / 86400000) : null
  const remove = () => {
    if (actionLock.current) return
    if (!confirm('Delete this listing permanently?')) return
    void runOwnerAction(async () => {
      const photos = await deleteOwnedListing(supabase, l.id, profile.id)
      if (!active.current) return
      setDeletedPhotos(photos)
      setMsg('Listing deleted. Removing photos…')
      await cleanDeletedPhotos(photos)
    })
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
        {urls.length ? urls.map((u, i) => u && <img key={i} src={u} alt={`${l.title} photo ${i + 1}`} loading={i ? 'lazy' : undefined} decoding="async" />) : <div className="thumb big"><span>No photo</span></div>}
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
        <p className="desc">{l.description}</p>
        <p className="muted small">Listed by {l.seller?.display_name}{l.seller?.batch ? ` (${l.seller.batch})` : ''} on {new Date(l.created_at).toLocaleDateString()}</p>
        {smooth > 0 && <p className="trust small">👍 {smooth} smooth deal{smooth === 1 ? '' : 's'}</p>}
        <div className="row">
          {!mine && l.status !== 'sold' && l.status !== 'removed' && <button className="primary" onClick={chat}>Chat with seller</button>}
          <button onClick={toggleSave} disabled={savedLoading || saving.has(l.id)}><Heart filled={saved} /> {saved ? 'Saved' : 'Save'}</button>
          <button onClick={share}>Share</button>
          {!mine && <button className="link" onClick={report}>Report</button>}
          {l.status !== 'removed' && <AdminRemove kind="listing" id={l.id} ownerId={l.seller_id} onRemoved={() => nav('/')} />}
        </div>
        {mine && (
          <div className="row">
            <Link to={`/sell/${l.id}`} className="btn" aria-disabled={busy} onClick={(e) => { if (actionLock.current) e.preventDefault() }}>Edit</Link>
            {l.status !== 'reserved' && <button disabled={busy} onClick={() => void setStatus('reserved')}>Mark reserved</button>}
            {l.status !== 'active' && <button disabled={busy} onClick={() => void setStatus('active')}>Mark available</button>}
            {l.status !== 'sold' && <button disabled={busy} onClick={() => void setStatus('sold')}>Mark sold</button>}
            <button className="danger" disabled={busy} onClick={remove}>Delete</button>
          </div>
        )}
        {mine && daysLeft !== null && l.status !== 'sold' && (
          <p className={daysLeft <= 3 ? 'error small' : 'muted small'}>{daysLeft > 0 ? `Listing expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` : 'This listing has expired and is hidden from others.'} <button className="link" disabled={busy} onClick={() => void renew()}>Renew for 30 days</button></p>
        )}
        {msg && <p className="muted">{msg}</p>}
        {saveError && <p className="error" role="alert">{saveError} <button onClick={retrySaved} disabled={savedLoading || saving.size > 0}>Reload saved items</button></p>}
      </div>
    </div>
  )
}
