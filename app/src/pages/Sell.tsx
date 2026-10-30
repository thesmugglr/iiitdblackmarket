import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CATEGORIES, CONDITIONS, MAX_PHOTOS, MAX_PHOTO_BYTES, PICKUP_AREAS, TYPES } from '../lib/constants'
import type { Listing } from '../lib/types'

export default function Sell() {
  const { id } = useParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({
    title: '', description: '', listing_type: 'sale', category: 'misc', condition: 'good',
    price_inr: '', negotiable: false, pickup_area: PICKUP_AREAS[0], rental_period: '', deposit_inr: '',
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!id) return
    supabase.from('listings').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      const l = data as Listing | null
      if (!l || l.seller_id !== profile?.id) return setErr('You cannot edit this listing.')
      setF({
        title: l.title, description: l.description, listing_type: l.listing_type, category: l.category,
        condition: l.condition, price_inr: String(l.price_inr), negotiable: l.negotiable,
        pickup_area: l.pickup_area ?? '', rental_period: l.rental_period ?? '', deposit_inr: l.deposit_inr?.toString() ?? '',
      })
      setPhotos(l.photos)
    })
  }, [id, profile?.id])

  const upload = async (files: FileList | null) => {
    if (!files || !profile) return
    setErr('')
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) return setErr(`At most ${MAX_PHOTOS} photos.`)
      if (!file.type.startsWith('image/')) return setErr('Only image files are allowed.')
      if (file.size > MAX_PHOTO_BYTES) return setErr('Each photo must be under 5 MB.')
      const path = `${profile.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from('listing-photos').upload(path, file)
      if (error) return setErr(error.message)
      next.push(path)
    }
    setPhotos(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setErr('')
    const giveaway = f.listing_type === 'giveaway'
    const row = {
      title: f.title.trim(), description: f.description.trim(), listing_type: f.listing_type,
      category: f.category, condition: f.condition, negotiable: !giveaway && f.negotiable,
      price_inr: giveaway ? 0 : Number(f.price_inr || 0), pickup_area: f.pickup_area || null,
      rental_period: f.listing_type === 'rent' ? f.rental_period || null : null,
      deposit_inr: f.listing_type === 'rent' && f.deposit_inr ? Number(f.deposit_inr) : null,
      photos,
    }
    const res = id
      ? await supabase.from('listings').update(row).eq('id', id).select('id').single()
      : await supabase.from('listings').insert({ ...row, seller_id: profile.id }).select('id').single()
    setBusy(false)
    if (res.error) return setErr(res.error.message)
    nav(`/listing/${res.data.id}`)
  }

  return (
    <form onSubmit={submit} className="form">
      <h1>{id ? 'Edit listing' : 'New listing'}</h1>
      <label>Photos ({photos.length}/{MAX_PHOTOS})
        <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} />
      </label>
      {photos.length > 0 && (
        <ul className="chips">
          {photos.map((p) => (
            <li key={p}>{p.split('/').pop()?.slice(37)} <button type="button" className="link" onClick={() => setPhotos(photos.filter((x) => x !== p))}>remove</button></li>
          ))}
        </ul>
      )}
      <label>Title<input required minLength={3} maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
      <label>Description<textarea rows={4} maxLength={4000} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <div className="two">
        <label>Type<select value={f.listing_type} onChange={(e) => set('listing_type', e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Category<select value={f.category} onChange={(e) => set('category', e.target.value)}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Condition<select value={f.condition} onChange={(e) => set('condition', e.target.value)}>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Pickup area<select value={f.pickup_area} onChange={(e) => set('pickup_area', e.target.value)}>
          {PICKUP_AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
      </div>
      {f.listing_type !== 'giveaway' && (
        <div className="two">
          <label>{f.listing_type === 'rent' ? 'Rent (₹)' : 'Price (₹)'}<input required type="number" min="0" value={f.price_inr} onChange={(e) => set('price_inr', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={f.negotiable} onChange={(e) => set('negotiable', e.target.checked)} /> Negotiable</label>
        </div>
      )}
      {f.listing_type === 'rent' && (
        <div className="two">
          <label>Rental period<input placeholder="e.g. per week, one semester" value={f.rental_period} onChange={(e) => set('rental_period', e.target.value)} /></label>
          <label>Deposit (₹)<input type="number" min="0" value={f.deposit_inr} onChange={(e) => set('deposit_inr', e.target.value)} /></label>
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Publish listing'}</button>
    </form>
  )
}
