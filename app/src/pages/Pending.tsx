import { useAuth } from '../lib/auth'

export default function Pending() {
  const { profile, refresh, signOut } = useAuth()
  const suspended = profile?.status === 'suspended'
  return (
    <div className="center-box">
      <h1>{suspended ? 'Account suspended' : 'Awaiting approval'}</h1>
      <p className="muted">
        {suspended
          ? 'Your account has been suspended by an administrator.'
          : `${profile?.email} is an institute account, but an admin must confirm you are a current student before you can use the marketplace.`}
      </p>
      {!suspended && <button onClick={refresh}>Check again</button>}
      <button className="link" onClick={signOut}>Sign out</button>
    </div>
  )
}
