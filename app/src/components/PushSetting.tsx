import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'

export default function PushSetting() {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const active = useRef(false)
  const changing = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    active.current = true
    const check = () => {
      if (changing.current || document.hidden) return
      const request = ++revision.current
      pushState(supabase).then(s => { if (active.current && !changing.current && request === revision.current) setState(s) })
        .catch(() => { if (active.current && !changing.current && request === revision.current) setState('error') })
    }
    check()
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { active.current = false; ++revision.current; window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [])

  const change = async (on: boolean) => {
    if (changing.current) return
    ++revision.current
    changing.current = true
    setBusy(true)
    setErr('')
    try { const next = on ? await enablePush(supabase) : await disablePush(supabase); if (active.current) setState(next) }
    catch (e) { if (active.current) { setState('error'); setErr(e instanceof Error ? e.message : 'Could not change notifications. Please try again.') } }
    finally { changing.current = false; if (active.current) setBusy(false) }
  }

  if (state === 'loading') return null
  return (
    <div className="panel small push-setting" role="status">
      {state === 'on' && <>Notifications are on for this device. <button disabled={busy} onClick={() => void change(false)}>Turn off</button></>}
      {state === 'off' && <>Get a notification on this phone or computer for new messages, offers, price drops and replies, even when the site is closed. <button className="primary" disabled={busy} onClick={() => void change(true)}>{busy ? 'Turning on…' : 'Turn on notifications'}</button></>}
      {(state === 'repair' || state === 'error') && <>Device registration needs checking. <button disabled={busy} onClick={() => void change(true)}>Repair notifications</button></>}
      {state === 'blocked' && <>Notifications are blocked for this site in your browser settings. Allow them there, then come back here.</>}
      {state === 'needs-install' && <>On iPhone and iPad, notifications only work from the Home Screen app: tap Share, then Add to Home Screen, open it from there and turn notifications on. <Link to="/install">How to install</Link></>}
      {state === 'unavailable' && <>Phone notifications are not switched on for the site yet.</>}
      {state === 'unsupported' && <>This browser cannot show notifications while the site is closed.</>}
      {err && <p className="error small" role="alert">{err}</p>}
    </div>
  )
}
