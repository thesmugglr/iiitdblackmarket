import { useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import LandingPage from '../features/landing/LandingPage'
import '../features/landing/landing.css'

export default function Login() {
  const [err, setErr] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const go = async () => {
    if (!isConfigured || signingIn) return
    setErr('')
    setSigningIn(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { hd: 'iiitd.ac.in', prompt: 'select_account' } },
      })
      if (error) setErr(error.message)
    } catch {
      setErr('Could not open sign-in. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }
  return (
    <LandingPage configured={isConfigured} signingIn={signingIn} error={err} onSignIn={go} />
  )
}
