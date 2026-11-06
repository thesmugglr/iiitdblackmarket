import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'

/** On/off control for notifications on this phone or computer. `compact` hides the states that need no action. */
export default function PushSetting({ compact = false, onState }: { compact?: boolean; onState?: (state: PushState) => void }) {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    pushState(supabase).then((s) => { if (live) setState(s) }).catch(() => { if (live) setState('unsupported') })
    return () => { live = false }
  }, [])
  useEffect(() => { if (state !== 'loading') onState?.(state) }, [state, onState])

  const change = async (on: boolean) => {
    setBusy(true)
    setErr('')
    try { setState(on ? await enablePush(supabase) : await disablePush(supabase)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not change notifications. Please try again.') }
    finally { setBusy(false) }
  }

  if (state === 'loading') return null
  if (compact && (state === 'unsupported' || state === 'unavailable' || state === 'on')) return null
  return (
    <div className="panel small push-setting" role="status">
      {state === 'on' && <>Notifications are on for this device. <button disabled={busy} onClick={() => void change(false)}>Turn off</button></>}
      {state === 'off' && <>Get a notification on this phone or computer for new messages, offers, price drops and replies, even when the site is closed. <button className="primary" disabled={busy} onClick={() => void change(true)}>{busy ? 'Turning on…' : 'Turn on notifications'}</button></>}
      {state === 'blocked' && <>Notifications are blocked for this site in your browser settings. Allow them there, then come back here.</>}
      {state === 'needs-install' && <>On iPhone and iPad, notifications only work from the Home Screen app: tap Share, then Add to Home Screen, open it from there and turn notifications on. <Link to="/install">How to install</Link></>}
      {state === 'unavailable' && <>Phone notifications are not switched on for the site yet.</>}
      {state === 'unsupported' && <>This browser cannot show notifications while the site is closed.</>}
      {err && <p className="error small" role="alert">{err}</p>}
    </div>
  )
}
