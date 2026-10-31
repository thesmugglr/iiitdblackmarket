import { spawnSync } from 'node:child_process'

export function validateLocalStack(env) {
  let url
  try { url = new URL(env.API_URL) } catch { throw new Error('Local stack API_URL is missing or invalid.') }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('E2E tests require a loopback HTTP Supabase stack; hosted endpoints are refused.')
  }
  if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY) throw new Error('Local stack keys are missing. Start the local Supabase stack first.')
  return env
}

export function readLocalStack() {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'supabase@2.122.0', 'status', '-o', 'env'], {
      cwd: new URL('../../', import.meta.url), encoding: 'utf8',
      shell: process.platform === 'win32', timeout: 30000,
    })
  // Never print CLI output: it contains service-role credentials even on some failures.
  if (result.error || result.status !== 0) throw new Error('Cannot read the local Supabase stack. Install/start Docker and run the documented local setup.')
  const env = Object.fromEntries(result.stdout.split(/\r?\n/).map(l => l.match(/^(\w+)="(.*)"$/)).filter(Boolean).map(m => [m[1], m[2]]))
  return validateLocalStack(env)
}
