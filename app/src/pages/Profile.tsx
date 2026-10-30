import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ListingCard from '../components/ListingCard'
import { inr } from '../lib/constants'
import type { Listing } from '../lib/types'

interface Deal { id: string; amount_inr: number; listing: { title: string } | null }

export default function Profile() {
  const { profile, refresh } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [batch, setBatch] = useState(profile?.batch ?? '')
  const [mine, setMine] = useState<Listing[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('listings').select('*').eq('seller_id', profile.id).neq('status', 'removed').order('created_at', { ascending: false })
      .then(({ data }) => setMine((data ?? []) as Listing[]))
    supabase.from('offers').select('id, amount_inr, listing:listings(title)').eq('status', 'accepted')
      .then(({ data }) => setDeals((data ?? []) as unknown as Deal[]))
  }, [profile])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ display_name: name.trim(), batch: batch.trim() || null }).eq('id', profile!.id)
    setMsg(error ? error.message : 'Saved.')
    await refresh()
  }
  if (!profile) return null
  return (
    <>
      <h1>Profile</h1>
      <p className="muted small">{profile.email} · {profile.status === 'approved' ? 'Verified student' : profile.status}. Your email is not shown to other users.</p>
      <form onSubmit={save} className="form">
        <div className="two">
          <label>Display name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Batch (optional)<input placeholder="e.g. 2027" value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
        </div>
        <button className="primary">Save profile</button>
        {msg && <span className="muted"> {msg}</span>}
      </form>
      <h2>My listings</h2>
      {mine.length === 0 && <p className="muted">You have not listed anything yet.</p>}
      <div className="grid">{mine.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      <h2>Completed deals</h2>
      {deals.length === 0 && <p className="muted">Accepted offers will show up here.</p>}
      <ul className="list">{deals.map((d) => <li key={d.id}>{d.listing?.title} — {inr(d.amount_inr)}</li>)}</ul>
    </>
  )
}
