import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './lib/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)

// Installable app: register the small service worker in production builds only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => { /* optional enhancement */ })
  })
}
