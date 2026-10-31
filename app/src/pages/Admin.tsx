import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface Report {
  id: string; reason: string; status: string; listing_id: string | null; message_id: string | null
  reporter: { display_name: string } | null
}

export default function Admin() {
  const [users, setUsers] = useState<Profile[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [roster, setRoster] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const u = await supabase.rpc('admin_profiles')
    setUsers((u.data ?? []) as Profile[])
    const r = await supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(display_name)').eq('status', 'open').order('created_at')
    setReports((r.data ?? []) as unknown as Report[])
  }, [])
  useEffect(() => { void load() }, [load])

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc('admin_set_status', { p_user: id, p_status: status })
    setMsg(error?.message ?? '')
    void load()
  }
  const removeListing = async (r: Report) => {
    if (!r.listing_id) return
    await supabase.from('listings').update({ status: 'removed' }).eq('id', r.listing_id)
    await resolve(r, 'resolved')
  }
  const resolve = async (r: Report, status: 'resolved' | 'dismissed') => {
    await supabase.from('reports').update({ status }).eq('id', r.id)
    void load()
  }
  const addRoster = async () => {
    const emails = roster.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.endsWith('@iiitd.ac.in'))
    if (!emails.length) return setMsg('No valid @iiitd.ac.in emails found.')
    const { error } = await supabase.from('student_roster').upsert(emails.map((email) => ({ email })))
    if (error) return setMsg(error.message)
    // Approve already-registered pending users on the roster.
    for (const u of users.filter((x) => x.status === 'pending' && emails.includes(x.email))) await setStatus(u.id, 'approved')
    setMsg(`Added ${emails.length} roster entries.`)
    setRoster('')
  }

  return (
    <>
      <h1>Admin</h1>
      {msg && <p className="muted">{msg}</p>}
      <h2>Student roster</h2>
      <p className="muted small">Paste current-student emails (separated by spaces, commas or new lines). Anyone listed is approved automatically on sign-up.</p>
      <textarea rows={3} value={roster} onChange={(e) => setRoster(e.target.value)} />
      <button onClick={addRoster}>Add to roster</button>

      <h2>Open reports ({reports.length})</h2>
      {reports.length === 0 && <p className="muted">No open reports.</p>}
      <ul className="list">
        {reports.map((r) => (
          <li key={r.id}>
            <div>{r.reason} <span className="muted small">— {r.reporter?.display_name}</span></div>
            <div className="row">
              {r.listing_id && <Link to={`/listing/${r.listing_id}`}>View listing</Link>}
              {r.listing_id && <button className="danger" onClick={() => removeListing(r)}>Remove listing</button>}
              <button onClick={() => resolve(r, 'resolved')}>Resolve</button>
              <button onClick={() => resolve(r, 'dismissed')}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Waiting for approval ({users.filter((u) => u.status === 'pending').length})</h2>
      <p className="muted small">Approve only people you can confirm are current students: faculty and staff share the institute email domain.</p>
      {users.every((u) => u.status !== 'pending') && <p className="muted">Nobody is waiting.</p>}
      <ul className="list">
        {users.filter((u) => u.status === 'pending').map((u) => (
          <li key={u.id} className="row between">
            <span>{u.display_name} <span className="muted small">{u.email}</span></span>
            <span className="row">
              <button className="primary" onClick={() => setStatus(u.id, 'approved')}>Approve</button>
              <button className="danger" onClick={() => setStatus(u.id, 'suspended')}>Reject</button>
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
              {u.status !== 'approved' && <button onClick={() => setStatus(u.id, 'approved')}>Approve</button>}
              {u.status !== 'suspended' && u.role !== 'admin' && <button className="danger" onClick={() => setStatus(u.id, 'suspended')}>Suspend</button>}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
