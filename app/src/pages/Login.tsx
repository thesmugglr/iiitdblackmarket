import { useState } from 'react'
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
  return (
    <div className="login">
      <div className="login-main">
        <span className="brand"><span className="mark">B</span><span>IIITD <em>Black Market</em></span></span>
        <h1>Pass it on, <br />don’t throw it out.</h1>
        <p className="lede">A noticeboard for IIIT-Delhi students to sell, rent and give away cycles, books, cookers and everything else a hostel room collects.</p>
        {!isConfigured && <p className="error">Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and add your project keys.</p>}
        <button className="primary big" onClick={go} disabled={!isConfigured}>Continue with IIITD Google</button>
        {err && <p className="error">{err}</p>}
        <p className="fine">Only @iiitd.ac.in accounts can sign in. Current students are approved before they can browse.</p>
      </div>
      <ul className="login-board" aria-hidden="true">
        {Object.values(CATEGORIES).map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  )
}
