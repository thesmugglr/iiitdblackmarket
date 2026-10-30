import { useState, type FormEvent } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../lib/constants'

export default function Login() {
  const [err, setErr] = useState('')
  const go = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { hd: 'iiitd.ac.in', prompt: 'select_account' } },
    })
    if (error) setErr(error.message)
  }
  const devLogin = import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dev = async (e: FormEvent, signUp: boolean) => {
    e.preventDefault()
    const { error } = signUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
  }
  return (
    <div className="login">
      <div className="login-main">
        <span className="wordmark">IIITD Black Market<i>.</i></span>
        <h1>Pass it on, <br />don’t throw it out.</h1>
        <p className="lede">A noticeboard for IIIT-Delhi students to sell, rent and give away cycles, books, cookers and everything else a hostel room collects.</p>
        {!isConfigured && <p className="error">Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and add your project keys.</p>}
        <button className="primary big" onClick={go} disabled={!isConfigured}>Continue with IIITD Google</button>
        {err && <p className="error">{err}</p>}
        {devLogin && (
          <form className="form panel" onSubmit={(e) => dev(e, false)}>
            <strong>Local development sign-in</strong>
            <label>Email<input type="email" required placeholder="you@iiitd.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <div className="row"><button className="primary">Sign in</button><button type="button" onClick={(e) => dev(e, true)}>Create account</button></div>
          </form>
        )}
        <p className="fine">Only @iiitd.ac.in accounts can sign in. Current students are approved before they can browse.</p>
      </div>
      <ul className="login-board" aria-hidden="true">
        {Object.values(CATEGORIES).map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  )
}
