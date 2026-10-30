import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { inr } from '../lib/constants'
import type { Listing } from '../lib/types'

export default function BundleNew() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [mine, setMine] = useState<Listing[] | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('listings').select('*').eq('seller_id', profile.id).eq('status', 'active')
      .then(({ data }) => setMine((data ?? []) as Listing[]))
  }, [profile])

  const total = (mine ?? []).filter((l) => sel.includes(l.id)).reduce((n, l) => n + l.price_inr, 0)
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sel.length < 2) return setErr('Pick at least two listings.')
    const { data, error } = await supabase.rpc('create_bundle', { p_title: title.trim(), p_description: desc.trim(), p_price: Number(price), p_listings: sel })
    if (error) return setErr(error.message)
    nav(`/bundles/${data}`)
  }
  if (!mine) return <p className="muted">Loading…</p>
  return (
    <form onSubmit={submit} className="form">
      <h1>Make a bundle</h1>
      {mine.length < 2 && <p className="muted">You need at least two active listings. <Link to="/sell">List an item</Link> first.</p>}
      <fieldset className="pick">
        <legend>Choose items (2 to 10)</legend>
        {mine.map((l) => (
          <label key={l.id} className="check"><input type="checkbox" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} /> {l.title} <span className="muted">{inr(l.price_inr)}</span></label>
        ))}
      </fieldset>
      <label>Bundle name<input required minLength={3} maxLength={120} placeholder="Full hostel room starter kit" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Description<textarea rows={3} maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label>Bundle price (₹){sel.length > 0 && <span className="muted"> · items add up to {inr(total)}</span>}<input required type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={mine.length < 2}>Publish bundle</button>
    </form>
  )
}
