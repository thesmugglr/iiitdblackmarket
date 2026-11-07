import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { canTakePhoto } from '../lib/device'
import { useAuth } from '../lib/auth'
import { CATEGORIES, CONDITIONS, MAX_PHOTOS, TYPES } from '../lib/constants'
import { preparePhoto, thumbPath } from '../lib/image'
import { usePhotoThumbs } from '../lib/useSignedUrls'
import { observeEditableListing } from '../lib/editableListing'
import { observeListingSave, writeListingDraft } from '../lib/listingSave'
import { cleanupListingPhotos } from '../lib/listingActions'
import type { Listing } from '../lib/types'

export default function Sell() {
  const { id } = useParams()
  const { profile } = useAuth()
  // Create/edit routes must not inherit another listing's draft or photo paths.
  return profile ? <ListingEditor key={`${profile.id}:${id ? `edit:${id}` : 'create'}`} id={id} /> : null
}

function ListingEditor({ id }: { id?: string }) {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [ready, setReady] = useState(!id)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [f, setF] = useState({
    title: '', description: '', listing_type: 'sale', category: 'misc', condition: 'good',
    price_inr: '', negotiable: false, rental_period: '', deposit_inr: '',
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(0) // photos still to upload in the current batch
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fresh = useRef(new Set<string>()) // photos uploaded in this session and not yet saved
  const dropped = useRef<string[]>([]) // saved photos the seller removed; deleted once the edit is saved
  const saver = useRef<ReturnType<typeof observeListingSave> | null>(null)
  const urls = usePhotoThumbs(photos)
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!profile) return
    const freshPhotos = fresh.current
    const current = observeListingSave({
      id, newId: () => crypto.randomUUID(),
      write: request => writeListingDraft(supabase, profile.id, request),
      cleanup: async (row, canClean) => {
        const removed = dropped.current.filter(p => !row.photos.includes(p) && canClean(p))
        await cleanupListingPhotos(supabase, profile.id, removed)
      },
      saved: listingId => { freshPhotos.clear(); dropped.current = []; nav(`/listing/${listingId}`) },
      publish: state => { setBusy(state.busy); setErr(state.error) },
    })
    saver.current = current
    return () => {
      current.dispose()
      // Submitted photos may already be linked even when the reply was lost.
      const abandoned = [...freshPhotos].filter(current.canClean)
      if (abandoned.length) void supabase.storage.from('listing-photos').remove(abandoned.flatMap(p => [p, thumbPath(p)]))
      saver.current = null
    }
  }, [id, profile?.id, nav]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return
    return observeEditableListing(id, profile?.id ?? '', async () => {
      const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Listing | null
    }, l => {
      setF({
        title: l.title, description: l.description, listing_type: l.listing_type, category: l.category,
        condition: l.condition, price_inr: String(l.price_inr), negotiable: l.negotiable,
        rental_period: l.rental_period ?? '', deposit_inr: l.deposit_inr?.toString() ?? '',
      })
      setPhotos(l.photos)
      setReady(true)
    }, setLoadError)
  }, [id, profile?.id, attempt])

  const uploadLock = useRef(false)
  const upload = async (files: File[]) => {
    // One batch at a time: overlapping selections would otherwise race on the photo list.
    const current = saver.current
    if (!files.length || !profile || !ready || uploadLock.current || !current?.isActive() || current.isBusy()) return
    setErr('')
    if (photos.length + files.length > MAX_PHOTOS) return setErr(`At most ${MAX_PHOTOS} photos in total. Remove one first, or pick fewer.`)
    if (files.some((f) => !f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name))) return setErr('Choose image files (JPG, PNG, WebP, HEIC).')
    uploadLock.current = true
    setUploading(files.length)
    try {
      for (const file of files) {
        const { blob, thumb, ext, type } = await preparePhoto(file, { thumb: true })
        if (!current.isActive()) return
        const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
        // File names are random and never reused, so browsers may keep the pictures for a year.
        const { error } = await supabase.storage.from('listing-photos').upload(path, blob, { contentType: type, cacheControl: '31536000' })
        if (error) throw new Error(error.message)
        if (!current.isActive()) return
        fresh.current.add(path)
        // The small copy used in grids is optional: if it does not upload, the full-size photo is shown instead.
        if (thumb) await supabase.storage.from('listing-photos').upload(thumbPath(path), thumb, { contentType: type, cacheControl: '31536000' })
        if (!current.isActive()) return
        // Commit each success immediately so a later failure never hides photos that already uploaded.
        setPhotos((current) => [...current, path])
        setUploading((n) => n - 1)
      }
    } catch (e) {
      if (current.isActive()) setErr(e instanceof Error ? e.message : 'Upload failed. Check your connection and try again.')
    } finally {
      uploadLock.current = false
      if (current.isActive()) setUploading(0)
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void upload(Array.from(e.dataTransfer.files))
  }
  const remove = (p: string) => {
    if (!saver.current?.isActive() || saver.current.isBusy() || uploadLock.current) return
    setPhotos((list) => list.filter((x) => x !== p))
    if (fresh.current.has(p) && saver.current.canClean(p)) { fresh.current.delete(p); void supabase.storage.from('listing-photos').remove([p, thumbPath(p)]) }
    else dropped.current.push(p)
  }
  const makeCover = (p: string) => setPhotos((list) => [p, ...list.filter((x) => x !== p)])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !ready || saver.current?.isBusy()) return
    if (uploading || uploadLock.current) return setErr('Wait for your photos to finish uploading.')
    const giveaway = f.listing_type === 'giveaway'
    const row = {
      title: f.title.trim(), description: f.description.trim(), listing_type: f.listing_type,
      category: f.category, condition: f.condition, negotiable: !giveaway && f.negotiable,
      // No pickup location any more (owner's request); saving clears one left on an older listing.
      price_inr: giveaway ? 0 : Number(f.price_inr || 0), pickup_area: null,
      rental_period: f.listing_type === 'rent' ? f.rental_period || null : null,
      deposit_inr: f.listing_type === 'rent' && f.deposit_inr ? Number(f.deposit_inr) : null,
      photos,
    }
    await saver.current?.save(row)
  }

  if (!ready) {
    if (!loadError) return <p className="muted">Loading…</p>
    return <div><p role="alert">{loadError}</p><button onClick={() => { setLoadError(''); setAttempt(n => n + 1) }}>Try again</button> <Link to="/profile">Back to profile</Link></div>
  }

  return (
    <form onSubmit={submit} className="form">
      <h1>{id ? 'Edit listing' : 'List an item'}</h1>
      <p className="muted">Add clear photos, say what it is and what shape it's in. Buyers will message you here.</p>

      <div className={`dropzone ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <label className="btn" htmlFor="photo-input">{photos.length ? 'Add more photos' : 'Choose photos'}</label>
        <input id="photo-input" className="visually-hidden" type="file" accept="image/*" multiple disabled={photos.length >= MAX_PHOTOS || uploading > 0 || busy}
          onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        {canTakePhoto() && (<>
          <label className="btn" htmlFor="camera-input">Take photo</label>
          <input id="camera-input" className="visually-hidden" type="file" accept="image/*" capture="environment" disabled={photos.length >= MAX_PHOTOS || uploading > 0 || busy}
            onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </>)}
        <span className="muted small">or drop them here. Up to {MAX_PHOTOS}; large photos are resized for you.</span>
        {uploading > 0 && <span role="status" className="small">Uploading {uploading} photo{uploading === 1 ? '' : 's'}…</span>}
      </div>
      {photos.length > 0 && (
        <ul className="photo-grid">
          {photos.map((p, i) => (
            <li key={p}>
              {urls[i] ? <img src={urls[i]} alt={`Photo ${i + 1}`} /> : <div className="skeleton" />}
              {i === 0 ? <span className="tag">Cover</span> : <button type="button" className="mini" disabled={uploading > 0 || busy} onClick={() => makeCover(p)}>Make cover</button>}
              <button type="button" className="mini danger" aria-label={`Remove photo ${i + 1}`} disabled={uploading > 0 || busy} onClick={() => remove(p)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <label>Title<input disabled={busy} required minLength={3} maxLength={120} placeholder="e.g. Hero Sprint 21-speed cycle" value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
      <label>Description<textarea disabled={busy} rows={4} maxLength={4000} placeholder="Age, brand, any defects, why you're selling" value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <div className="two">
        <label>Type<select disabled={busy} value={f.listing_type} onChange={(e) => set('listing_type', e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Category<select disabled={busy} value={f.category} onChange={(e) => set('category', e.target.value)}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Condition<select disabled={busy} value={f.condition} onChange={(e) => set('condition', e.target.value)}>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>      </div>
      {f.listing_type !== 'giveaway' && (
        <div className="two">
          <label>{f.listing_type === 'rent' ? 'Rent (₹)' : 'Price (₹)'}<input disabled={busy} required type="number" min="0" inputMode="numeric" value={f.price_inr} onChange={(e) => set('price_inr', e.target.value)} /></label>
          <label className="check"><input disabled={busy} type="checkbox" checked={f.negotiable} onChange={(e) => set('negotiable', e.target.checked)} /> Negotiable</label>
        </div>
      )}
      {f.listing_type === 'rent' && (
        <div className="two">
          <label>Rental period<input disabled={busy} placeholder="e.g. per week, one semester" value={f.rental_period} onChange={(e) => set('rental_period', e.target.value)} /></label>
          <label>Deposit (₹)<input disabled={busy} type="number" min="0" inputMode="numeric" value={f.deposit_inr} onChange={(e) => set('deposit_inr', e.target.value)} /></label>
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="primary" disabled={busy || uploading > 0}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish listing'}</button>
      <p className="muted small">Listings stay up for 30 days; you can renew them. No illegal, unsafe or prohibited items. Meet in busy campus spots, and <Link to="/inbox">keep chats here</Link> so admins can help if something goes wrong.</p>
    </form>
  )
}
