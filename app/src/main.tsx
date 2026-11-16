import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './lib/install'
import { isConfigured, supabase } from './lib/supabase'
import { recordVisit } from './lib/visits'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)

// Anonymous once-a-day visit count (production builds only; docs/visit-counter.md).
if (import.meta.env.PROD && isConfigured) void recordVisit(supabase)

// Installable app: register the small service worker in production builds only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => { /* optional enhancement */ })
  })
}
