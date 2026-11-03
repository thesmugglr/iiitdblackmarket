import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ListingCard from '../components/ListingCard'
import { inr } from '../lib/constants'
import type { Profile as MemberProfile } from '../lib/types'
import { emptyDashboard, loadProfileDashboard, observeProfileDashboard, saveProfile } from '../lib/profileData'

export default function Profile() {
  const { profile, refresh } = useAuth()
  return profile ? <ProfilePage key={profile.id} profile={profile} refresh={refresh} /> : null
}

function ProfilePage({ profile, refresh }: { profile: MemberProfile; refresh: () => Promise<void> }) {
  const [name, setName] = useState(profile.display_name)
  const [batch, setBatch] = useState(profile.batch ?? '')
  const [{ mine, deals, loading, error }, setDashboard] = useState(emptyDashboard)
  const [attempt, setAttempt] = useState(0)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const active = useRef(false)

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => observeProfileDashboard(() => loadProfileDashboard(supabase, profile.id), setDashboard), [profile.id, attempt])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setMsg('')
    try {
      const confirmed = await saveProfile(supabase, profile.id, name, batch)
      if (!active.current) return
      setName(confirmed.display_name)
      setBatch(confirmed.batch ?? '')
      setMsg('Saved.')
      await refresh()
    } catch (error) {
      if (active.current) setMsg(error instanceof Error ? error.message : 'Could not confirm the profile save. Your entries are retained; please try again.')
    } finally {
      inFlight.current = false
      if (active.current) setSaving(false)
    }
  }
  return (
    <>
      <h1>Profile</h1>
      <p className="muted small">{profile.email} · {profile.status === 'approved' ? 'Verified student' : profile.status}. Your email is not shown to other users.</p>
      <form onSubmit={save} className="form">
        <div className="two">
          <label>Display name<input required disabled={saving} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Batch (optional)<input disabled={saving} placeholder="e.g. 2027" value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
        </div>
        <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        {msg && <span className="muted" role="status"> {msg}</span>}
      </form>
      {loading && <p className="muted" role="status">Loading your listings and completed deals…</p>}
      {error && <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
      <h2>My listings</h2>
      {!loading && !error && mine.length === 0 && <p className="muted">You have not listed anything yet.</p>}
      <div className="grid">{mine.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      <h2>Completed deals</h2>
      {!loading && !error && deals.length === 0 && <p className="muted">Accepted offers will show up here.</p>}
      <ul className="list">{deals.map((d) => <li key={d.id}>{d.listing?.title} — {inr(d.amount_inr)}</li>)}</ul>
    </>
  )
}
