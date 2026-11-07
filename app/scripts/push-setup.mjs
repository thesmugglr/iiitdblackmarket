// One-time setup for push notifications on the hosted project (docs/push-notifications.md). Run from app/ after
// migration 0009 is live and after the owner has signed the Supabase CLI in once with `npx supabase login`:
//
//   npm run push:setup
//
// It creates this site's VAPID key pair (kept outside git in ~/iiitd-launch/vapid-keys.json, mode 600, and reused on
// later runs so existing phone subscriptions keep working), stores the function secrets with the Supabase CLI,
// deploys supabase/functions/push, and writes ~/iiitd-launch/push-config.sql with the two PUBLIC values the
// database needs. The private key is never printed. Everything used is on Supabase's free plan.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { readClientConfig } from '../src/lib/config.ts'

const SUBJECT = 'https://thesmugglr.github.io/'
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const launchFolder = join(homedir(), 'iiitd-launch')
const keysFile = join(launchFolder, 'vapid-keys.json')

const config = readClientConfig(loadEnv('production', process.cwd(), 'VITE_'), false)
if (!config.configured) {
  console.error('app/.env.production.local is not ready (no values printed). See docs/launch.md.')
  process.exit(1)
}
const ref = new URL(config.url).hostname.split('.')[0]
const cli = (args, options = {}) => execFileSync('npx', ['--yes', 'supabase', ...args], { cwd: repoRoot, stdio: 'inherit', ...options })

try {
  execFileSync('npx', ['--yes', 'supabase', 'projects', 'list'], { cwd: repoRoot, stdio: 'ignore' })
} catch {
  console.error('The Supabase CLI is not signed in. Run `npx supabase login` once (it opens the browser), then run this again.')
  process.exit(1)
}

const base64url = (bytes) => Buffer.from(bytes).toString('base64url')
async function vapidKeys() {
  if (existsSync(keysFile)) return JSON.parse(await readFile(keysFile, 'utf8'))
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const keys = {
    publicKey: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    privateKey: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d,
    createdAt: new Date().toISOString(),
  }
  await mkdir(launchFolder, { recursive: true })
  await writeFile(keysFile, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 })
  console.log(`Created a new VAPID key pair in ${keysFile} (keep it; do not commit it).`)
  return keys
}

const keys = await vapidKeys()
const work = await mkdtemp(join(tmpdir(), 'push-secrets-'))
try {
  const envFile = join(work, 'push.env')
  await writeFile(envFile, [
    `PUSH_API_KEY=${config.key}`,
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    `VAPID_SUBJECT=${SUBJECT}`,
    '',
  ].join('\n'), { mode: 0o600 })
  cli(['secrets', 'set', '--project-ref', ref, '--env-file', envFile])
} finally {
  await rm(work, { recursive: true, force: true })
}
cli(['functions', 'deploy', 'push', '--project-ref', ref, '--no-verify-jwt', '--use-api'])

const functionUrl = `https://${ref}.supabase.co/functions/v1/push`
const sqlFile = join(launchFolder, 'push-config.sql')
await writeFile(sqlFile, [
  '-- Public values for push notifications (no secrets). Run once in the Supabase SQL editor after `npm run push:setup`.',
  `update public.push_config set function_url = '${functionUrl}', vapid_public_key = '${keys.publicKey}';`,
  'select function_url is not null as configured, vapid_public_key is not null as has_key, length(secret) = 64 as secret_ready,',
  "       exists (select 1 from pg_extension where extname = 'pg_net') as pg_net_on from public.push_config;",
  '',
].join('\n'))
console.log(`\nDeployed ${functionUrl}\nNext: run ${sqlFile} in the Supabase SQL editor (public values only), then redeploy the site.`)
