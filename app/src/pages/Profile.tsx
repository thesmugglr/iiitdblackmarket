import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ListingCard from '../components/ListingCard'
import { inr } from '../lib/constants'
import type { Profile as MemberProfile } from '../lib/types'
import { emptyDashboard, loadProfileDashboard, observeProfileDashboard, saveProfile } from '../lib/profileData'
import PushSetting from '../components/PushSetting'
import { deleteMyAccount } from '../lib/accountDeletion'
import { forgetPhotoLinks } from '../lib/photoLinks'
import { forgetThisDevice } from '../lib/push'

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

  const [smooth, setSmooth] = useState(0)
  useEffect(() => {
    let live = true
    void supabase.rpc('smooth_deals', { p_seller: profile.id }).then(({ data }) => { if (live) setSmooth(typeof data === 'number' ? data : 0) })
    return () => { live = false }
  }, [profile.id])

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const confirmed = confirmText.trim().toUpperCase() === 'DELETE'
  const removeAccount = async () => {
    if (!confirmed || deleting) return
    setDeleteError('')
    setDeleting('Starting…')
    try {
      await forgetThisDevice(supabase)
      forgetPhotoLinks()
      await deleteMyAccount(supabase, profile.id, setDeleting)
      // Signed out: the app now shows the sign-in page.
    } catch (e) {
      if (active.current) {
        setDeleting('')
        setDeleteError(e instanceof Error ? e.message : 'Could not delete your account. Please try again.')
      }
    }
  }

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
      {smooth > 0 && <p className="trust">👍 Buyers gave {smooth} of your deals a thumbs-up.</p>}

      <h2>Notifications</h2>
      <PushSetting />

      <h2>Delete my account</h2>
      <details className="danger-zone">
        <summary>Delete my account permanently</summary>
        <p className="small">This deletes your profile, your listings and their photos, your chats and offers, saved items, requests, bundles and lost &amp; found posts. It cannot be undone. Thumbs-up you gave other sellers stay, without your name.</p>
        <label className="small">Type DELETE to confirm
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} disabled={Boolean(deleting)} autoComplete="off" />
        </label>
        <button className="danger" disabled={!confirmed || Boolean(deleting)} onClick={() => void removeAccount()}>{deleting || 'Delete my account'}</button>
        {deleteError && <p className="error small" role="alert">{deleteError}</p>}
      </details>
    </>
  )
}
