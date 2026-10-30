import { useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

export default function Login() {
  const [err, setErr] = useState('')
  const go = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { hd: 'iiitd.ac.in', prompt: 'select_account' } },
    })
    if (error) setErr(error.message)
  }
  return (
    <div className="center-box">
      <h1>IIITD Black Market</h1>
      <p className="muted">Buy, sell, rent and give away items on campus.</p>
      {!isConfigured && (
        <p className="error">Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and fill in your project keys.</p>
      )}
      <button className="primary" onClick={go} disabled={!isConfigured}>Sign in with IIITD Google account</button>
      {err && <p className="error">{err}</p>}
      <p className="muted small">Only @iiitd.ac.in accounts can sign in. Access to the marketplace needs student approval.</p>
    </div>
  )
}
