import { useEffect } from 'react'
import { useAuth } from '../lib/auth'

export default function Pending() {
  const { profile, refresh, signOut } = useAuth()
  const suspended = profile?.status === 'suspended'
  // Let people in as soon as an admin approves them, without a manual reload.
  useEffect(() => {
    if (suspended) return
    const t = setInterval(() => void refresh(), 15000)
    return () => clearInterval(t)
  }, [suspended, refresh])
  if (!profile) {
    return (
      <div className="center-box">
        <h1>We couldn't load your account</h1>
        <p className="muted">Sign out and sign in again. If this keeps happening, your account may have been removed by an admin.</p>
        <button className="primary" onClick={refresh}>Try again</button>
        <button className="link" onClick={signOut}>Sign out</button>
      </div>
    )
  }
  return (
    <div className="center-box">
      <h1>{suspended ? 'Account suspended' : 'Awaiting approval'}</h1>
      <p className="muted">
        {suspended
          ? 'Your account has been suspended by an administrator.'
          : `${profile.email} is an institute account, but it did not match the current B.Tech student list, so an admin has to confirm you are a current student (M.Tech, PhD and newly admitted students are reviewed by hand). The admins have been notified; this page updates by itself once you are approved.`}
      </p>
      {!suspended && <button onClick={refresh}>Check again</button>}
      <button className="link" onClick={signOut}>Sign out</button>
    </div>
  )
}
