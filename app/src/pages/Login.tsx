import { isLoopbackUrl } from '../lib/config'
import { useState, type FormEvent } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../lib/constants'
import { appUrl, rememberDestination } from '../lib/redirect'

/** Supabase reports sign-in failures in the URL after the redirect back from Google. */
function redirectError(): string {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  const description = params.get('error_description') ?? ''
  if (!description) return ''
  if (/iiitd|database error saving new user/i.test(description)) return 'Only @iiitd.ac.in accounts can sign in. Choose your institute account.'
  return 'Sign-in did not complete. Please try again.'
}

export default function Login() {
  const [err, setErr] = useState(redirectError)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    setErr('')
    rememberDestination()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: appUrl(), queryParams: { hd: 'iiitd.ac.in', prompt: 'select_account' } },
    })
    if (error) { setErr(error.message); setBusy(false) }
  }

  // Local development only: the Google provider needs real credentials, so the local stack offers email sign-in.
  const devLogin = import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN === '1' && isConfigured && isLoopbackUrl(import.meta.env.VITE_SUPABASE_URL) && isLoopbackUrl(window.location.origin)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dev = async (e: FormEvent, signUp: boolean) => {
    e.preventDefault()
    if (!devLogin) return
    const { error } = signUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
  }

  return (
    <div className="login">
      <div className="login-main">
        <span className="wordmark">IIITD Black Market<i>.</i></span>
        <h1>Pass it on, <br />don’t throw it out.</h1>
        <p className="lede">A noticeboard for IIIT-Delhi students to sell, rent and give away cycles, books, cookers and everything else a hostel room collects.</p>
        {!isConfigured && <p className="error">Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project keys.</p>}
        <button className="primary big" onClick={go} disabled={!isConfigured || busy}>{busy ? 'Opening Google…' : 'Continue with IIITD Google'}</button>
        {err && <p className="error" role="alert">{err}</p>}
        {devLogin && (
          <form className="form panel" onSubmit={(e) => dev(e, false)}>
            <strong>Local development sign-in</strong>
            <label>Email<input type="email" required placeholder="you@iiitd.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <div className="row"><button className="primary">Sign in</button><button type="button" onClick={(e) => dev(e, true)}>Create account</button></div>
          </form>
        )}
        <p className="fine">Only @iiitd.ac.in accounts can sign in. New members are approved by an admin before they can browse. By continuing you agree to the <a href={`${import.meta.env.BASE_URL}terms.html`}>terms</a> and <a href={`${import.meta.env.BASE_URL}privacy.html`}>privacy policy</a>.</p>
      </div>
      <ul className="login-board" aria-hidden="true">
        {Object.values(CATEGORIES).map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  )
}
