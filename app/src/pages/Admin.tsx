import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { addStudentRoster, changeMemberStatus, removeReportedListing, updateReportStatus } from '../lib/adminActions'

interface Report {
  id: string; reason: string; status: string; listing_id: string | null; message_id: string | null
  reporter: { display_name: string } | null
}

export default function Admin() {
  const [users, setUsers] = useState<Profile[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [roster, setRoster] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const active = useRef(false)
  const loadRequest = useRef(0)

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    setLoading(true)
    setLoadError('')
    try {
      const [u, r] = await Promise.all([
        supabase.rpc('admin_profiles'),
        supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(display_name)').eq('status', 'open').order('created_at'),
      ])
      if (!active.current || request !== loadRequest.current) return
      if (u.error || r.error || !u.data || !r.data) throw new Error('load failed')
      setUsers(u.data as Profile[])
      setReports(r.data as unknown as Report[])
    } catch {
      if (active.current && request === loadRequest.current) setLoadError('Could not load administrator data. Refresh and try again.')
    } finally {
      if (active.current && request === loadRequest.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    active.current = true
    void load()
    return () => { active.current = false }
  }, [load])

  const run = async (action: () => Promise<string>) => {
    if (inFlight.current || loading || loadError) return
    inFlight.current = true
    setBusy(true)
    setMsg('')
    try {
      const message = await action()
      if (active.current) setMsg(message)
    } catch (error) {
      if (active.current) setMsg(error instanceof Error ? error.message : 'The action could not be confirmed. Refresh and retry.')
    } finally {
      // Refresh even after a partial write; keep the failure message visible.
      if (active.current) await load()
      inFlight.current = false
      if (active.current) setBusy(false)
    }
  }
  const setStatus = (id: string, status: string) => run(async () => {
    await changeMemberStatus(supabase, id, status)
    return 'Member status updated.'
  })
  const removeListing = (r: Report) => run(async () => {
    await removeReportedListing(supabase, r)
    return 'Listing removed and report resolved.'
  })
  const resolve = (r: Report, status: 'resolved' | 'dismissed') => run(async () => {
    await updateReportStatus(supabase, r.id, status)
    return `Report ${status}.`
  })
  const addRoster = () => run(async () => {
    const result = await addStudentRoster(supabase, roster, users)
    if (active.current && !result.failed) setRoster('')
    return result.failed
      ? `Added ${result.added} roster entries. Approved ${result.approved} existing members; ${result.failed} approval(s) could not be confirmed. Emails retained: refresh and retry.`
      : `Added ${result.added} roster entries. Approved ${result.approved} existing members.`
  })
  const controlsDisabled = busy || loading || !!loadError

  return (
    <>
      <h1>Admin</h1>
      {msg && <p className="muted" role="status">{msg}</p>}
      {loading && <p className="muted" role="status">Loading administrator data…</p>}
      {loadError && <p role="alert">{loadError} <button disabled={busy || loading} onClick={() => void load()}>Retry</button></p>}
      <h2>Student roster</h2>
      <p className="muted small">Paste current-student emails (separated by spaces, commas or new lines). Anyone listed is approved automatically on sign-up.</p>
      <textarea rows={3} disabled={controlsDisabled} value={roster} onChange={(e) => setRoster(e.target.value)} />
      <button disabled={controlsDisabled} onClick={addRoster}>Add to roster</button>

      <h2>Open reports ({reports.length})</h2>
      {!loading && !loadError && reports.length === 0 && <p className="muted">No open reports.</p>}
      <ul className="list">
        {reports.map((r) => (
          <li key={r.id}>
            <div>{r.reason} <span className="muted small">— {r.reporter?.display_name}</span></div>
            <div className="row">
              {r.listing_id && <Link to={`/listing/${r.listing_id}`}>View listing</Link>}
              {r.listing_id && <button disabled={controlsDisabled} className="danger" onClick={() => removeListing(r)}>Remove listing</button>}
              <button disabled={controlsDisabled} onClick={() => resolve(r, 'resolved')}>Resolve</button>
              <button disabled={controlsDisabled} onClick={() => resolve(r, 'dismissed')}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Waiting for approval ({users.filter((u) => u.status === 'pending').length})</h2>
      <p className="muted small">Approve only people you can confirm are current students: faculty and staff share the institute email domain.</p>
      {!loading && !loadError && users.every((u) => u.status !== 'pending') && <p className="muted">Nobody is waiting.</p>}
      <ul className="list">
        {users.filter((u) => u.status === 'pending').map((u) => (
          <li key={u.id} className="row between">
            <span>{u.display_name} <span className="muted small">{u.email}</span></span>
            <span className="row">
              <button disabled={controlsDisabled} className="primary" onClick={() => setStatus(u.id, 'approved')}>Approve</button>
              <button disabled={controlsDisabled} className="danger" onClick={() => setStatus(u.id, 'suspended')}>Reject</button>
            </span>
          </li>
        ))}
      </ul>

      <h2>All members</h2>
      <ul className="list">
        {users.filter((u) => u.status !== 'pending').map((u) => (
          <li key={u.id} className="row between">
            <span>{u.display_name} <span className="muted small">{u.email} · {u.role} · {u.status}</span></span>
            <span className="row">
              {u.status !== 'approved' && <button disabled={controlsDisabled} onClick={() => setStatus(u.id, 'approved')}>Approve</button>}
              {u.status !== 'suspended' && u.role !== 'admin' && <button disabled={controlsDisabled} className="danger" onClick={() => setStatus(u.id, 'suspended')}>Suspend</button>}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
