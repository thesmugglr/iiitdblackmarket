/** Where Google/Supabase should send people back to: the site root, including any hosting sub-path. */
export const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href

export const POST_LOGIN_KEY = 'postLoginPath'

/** Remember the page a signed-out visitor asked for, as a router path (no hosting sub-path). */
export function rememberDestination() {
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    let path = window.location.pathname
    if (base && path.startsWith(base)) path = path.slice(base.length)
    path = (path || '/') + window.location.search
    if (path !== '/') sessionStorage.setItem(POST_LOGIN_KEY, path)
  } catch { /* storage unavailable: they land on the home page */ }
}
