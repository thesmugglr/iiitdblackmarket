import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { adminRemovePost, type PostKind } from '../lib/adminActions'

/** "Remove post" for administrators on other people's posts. Renders nothing for everyone else. */
export default function AdminRemove({ kind, id, ownerId, onRemoved }: { kind: PostKind; id: string; ownerId: string; onRemoved: () => void }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (profile?.role !== 'admin' || profile.id === ownerId) return null
  const remove = async () => {
    if (!confirm('Remove this post for everyone? Use this for posts that break the rules.')) return
    setBusy(true)
    setErr('')
    try { await adminRemovePost(supabase, kind, id); onRemoved() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not remove this post.') }
    finally { setBusy(false) }
  }
  return (
    <>
      <button className="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Removing…' : 'Remove post (admin)'}</button>
      {err && <span className="error small" role="alert">{err}</span>}
    </>
  )
}
