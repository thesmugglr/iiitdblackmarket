// Builds the site and publishes ONLY the static output to a GitHub Pages repository (source code stays private).
//
//   npm run deploy:pages -- <owner/repo>        e.g. npm run deploy:pages -- thesmugglr/thesmugglr.github.io
//   npm run deploy:pages -- <owner/repo> --dry-run   (build only, to inspect dist/)
//   npm run deploy:pages -- <old owner/repo> --redirect-to https://thesmugglr.github.io/
//        (no build: turns an OLD address into a redirect to the new one, see scripts/redirect-site.mjs)
//
// A repository named <owner>.github.io is served at the root of https://<owner>.github.io/; any other repository is
// served under /<name>/ (scripts/pages-site.mjs).
//
// Needs: `gh auth login` (git push over https), and production settings in app/.env.production.local:
//   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key>      (never a secret / service-role key)
// The target repo is public, its default branch is `main`, and Pages serves `main` from the root.
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnv } from 'vite'
import { readClientConfig } from '../src/lib/config.ts'
import { keepAlive } from './keepalive-workflow.mjs'
import { BUILD_MARKER, validatePagesTarget } from './pages-target.mjs'
import { pagesSite } from './pages-site.mjs'
import { redirectSite } from './redirect-site.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run') // build dist/ only; no clone, commit or push
const redirectAt = args.indexOf('--redirect-to')
const redirectTo = redirectAt >= 0 ? args[redirectAt + 1] : undefined
const repo = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--redirect-to') ?? process.env.DEPLOY_REPO
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || (redirectAt >= 0 && !redirectTo)) {
  console.error('Usage: npm run deploy:pages -- <owner/repo> [--dry-run | --redirect-to <https://new-address/>]')
  process.exit(1)
}
const { base, url: siteUrl } = pagesSite(repo)
const env = loadEnv('production', process.cwd(), 'VITE_')
const config = readClientConfig(env, false)
if (!config.configured) {
  console.error('Configuration is not ready (no credential values printed):')
  for (const issue of config.issues) console.error(`- ${issue}`)
  process.exit(1)
}

const run =(cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim()

// Build from an isolated env directory so local dev files (.env.local, demo or local-login switches, local keys) can
// never reach a public bundle. Only the two public values and the base path are provided.
if (!redirectTo) {
  const envDir = await mkdtemp(join(tmpdir(), 'pages-env-'))
  await writeFile(join(envDir, '.env.production'), `VITE_SUPABASE_URL=${config.url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${config.key}\nVITE_BASE=${base}\n`)
  const buildEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('VITE_')))
  buildEnv.VITE_ENV_DIR = envDir
  try {
    if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], { env: buildEnv })
    else run('npm', ['run', 'build'], { env: buildEnv })
  } finally { await rm(envDir, { recursive: true, force: true }) }
}

if (dryRun) {
  console.log('Dry run: built dist/ only. Nothing was cloned, committed or pushed.')
  process.exit(0)
}

// Read-only verification before cloning or replacing any target contents.
const metadata = JSON.parse(out('gh', ['api', `repos/${repo}`]))
const marker = JSON.parse(out('gh', ['api', `repos/${repo}/contents/.iiitd-market-build-only?ref=main`]))
validatePagesTarget(metadata, Buffer.from(marker.content ?? '', 'base64').toString('utf8'))

let source = 'unknown'
try { source = out('git', ['rev-parse', '--short', 'HEAD']) } catch { /* not a git checkout */ }

const work = await mkdtemp(join(tmpdir(), 'pages-'))
try {
  run('git', ['clone', '--depth', '1', '--branch', 'main', `https://github.com/${repo}.git`, work])
  for (const entry of await readdir(work)) if (entry !== '.git') await rm(join(work, entry), { recursive: true, force: true })
  if (redirectTo) {
    for (const [file, content] of Object.entries(redirectSite(redirectTo, base))) await writeFile(join(work, file), content)
  } else await cp('dist', work, { recursive: true })
  await writeFile(join(work, '.iiitd-market-build-only'), `${BUILD_MARKER}\n`)
  await mkdir(join(work, '.github/workflows'), { recursive: true })
  await writeFile(join(work, '.github/workflows/keepalive.yml'), keepAlive(config.url, config.key))
  const moved = redirectTo ? `# IIITD Black Market (moved)\n\nThis address only redirects to ${redirectTo}. Every page here sends the visitor to the same page on the new address; \`sw.js\` removes the old app's cache.\n\n` : ''
  await writeFile(join(work, 'README.md'), `${moved || '# IIITD Black Market (built site)\n\n'}This repository only holds the compiled static site served by GitHub Pages. It is generated by \`npm run deploy:pages\` from the private source repository; do not edit it by hand.\n\nThe workflow in \`.github/workflows/keepalive.yml\` pings the backend twice a week so a free-tier Supabase project is not paused for inactivity. When the repository has been quiet for 30 days it also adds an empty commit, because GitHub switches off scheduled workflows in a public repository after 60 days without one.\n`)
  run('git', ['add', '-A'], { cwd: work })
  const changed = out('git', ['status', '--porcelain'], { cwd: work })
  if (!changed) console.log('Nothing changed since the last deploy.')
  else {
    run('git', ['-c', 'user.name=IIITD Black Market deploy', '-c', 'user.email=deploy@users.noreply.github.com', 'commit', '-m', redirectTo ? `Redirect to ${redirectTo}` : `Deploy build of source ${source}`], { cwd: work })
    run('git', ['push', 'origin', 'HEAD'], { cwd: work })
  }
  console.log(`\nSite: ${siteUrl}${redirectTo ? ` (redirects to ${redirectTo})` : ''}`)
} finally {
  await rm(work, { recursive: true, force: true })
}
