import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadVisitSummary, type VisitSummary } from '../lib/visitStats'

// Shown only on the Admin page (route and database both admin-only).
export default function VisitorStats() {
  const [summary, setSummary] = useState<VisitSummary | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    loadVisitSummary(supabase)
      .then((s) => { if (active) setSummary(s) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  return (
    <>
      <h2>Visitors</h2>
      <p className="muted small">Devices that opened the site, counted once a day each (India time). Estimates only.</p>
      {error && <p className="muted" role="alert">Could not load visitor numbers.</p>}
      {!summary && !error && <p className="muted" role="status">Loading…</p>}
      {summary && (
        <>
          <ul className="list">
            {([['Today', summary.today], ['Last 7 days', summary.week], ['Last 30 days', summary.month], ['All time', summary.all]] as const).map(([label, t]) => (
              <li key={label} className="row between"><span>{label}</span><span>{t.visitors} <span className="muted small">({t.newDevices} new)</span></span></li>
            ))}
          </ul>
          {summary.days.length === 0 && <p className="muted">No visits counted yet.</p>}
          {summary.days.slice(0, 14).length > 0 && (
            <details>
              <summary className="muted small">Day by day</summary>
              <ul className="list">
                {summary.days.slice(0, 14).map((d) => (
                  <li key={d.day} className="row between"><span>{d.day}</span><span>{d.visitors} <span className="muted small">({d.new_devices} new)</span></span></li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  )
}
