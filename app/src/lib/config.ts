/** Configuration diagnostics only. Supabase verifies keys and user identity. */
type Environment = Record<string, unknown>
export function isLoopbackUrl(input: unknown): boolean {
  try {
    const url = new URL(String(input))
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && url.protocol === 'http:' && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}
const value = (env: Environment, key: string) => typeof env[key] === 'string' ? (env[key] as string).trim() : ''

function legacyRole(key: string): string | undefined {
  try {
    const parts = key.split('.')
    if (parts.length !== 3 || parts.some((part) => !part)) return undefined
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    return payload.role
  } catch { return undefined }
}

export function browserSecretNames(env: Environment): string[] {
  return Object.keys(env).filter((name) => {
    if (!name.startsWith('VITE_')) return false
    const entry = value(env, name)
    return /SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE/.test(name)
      || entry.startsWith('sb_secret_') || legacyRole(entry) === 'service_role'
  })
}

export function readClientConfig(env: Environment, allowLocal = false) {
  const issues: string[] = []
  const url = value(env, 'VITE_SUPABASE_URL')
  const publishable = value(env, 'VITE_SUPABASE_PUBLISHABLE_KEY')
  const key = publishable || value(env, 'VITE_SUPABASE_ANON_KEY')
  if (!url) issues.push('VITE_SUPABASE_URL is missing.')
  else {
    try {
      const parsed = new URL(url)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      if (parsed.hostname === 'your-project.supabase.co') issues.push('VITE_SUPABASE_URL is still an example.')
      if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') issues.push('VITE_SUPABASE_URL must be a project base URL without credentials, path, query, or fragment.')
      if (parsed.protocol !== 'https:' && !(allowLocal && local && parsed.protocol === 'http:')) issues.push('Use HTTPS for the hosted Supabase project URL.')
      if (local && !allowLocal) issues.push('A hosted build must not point to a loopback Supabase URL.')
    } catch { issues.push('VITE_SUPABASE_URL is not a valid URL.') }
  }
  if (!key) issues.push('VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) is missing.')
  else if (key.includes('replace_with_your_project_key') || (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && legacyRole(key) !== 'anon')) {
    issues.push('Use a Supabase publishable key or legacy anon key, never a server secret.')
  }
  for (const name of browserSecretNames(env)) issues.push(`${name} contains or names a server-only secret; remove it from browser configuration.`)
  return { configured: issues.length === 0, url, key, issues }
}
