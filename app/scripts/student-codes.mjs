// Builds the SQL that loads current student codes for automatic approval (supabase/migrations/0007_student_codes.sql).
//
// A code is the last five digits of a roll number (roll 2025025 -> 25025), which is also the numeric part of the
// student's institute address (abhik25025@iiitd.ac.in). The source is IIIT-Delhi's public B.Tech students page.
// ONLY the numbers are kept: names and programs are read to recognise table rows, then discarded. They are never
// printed or written, and the generated file contains codes only.
//
//   npm run student-codes                      (writes student-codes.local.sql for the current four batches)
//   npm run student-codes -- --dry-run         (prints counts only)
//   npm run student-codes -- --batches 2022-2026 --out ~/Downloads/larp/TheSmugglr/student-codes.sql
//
// Run the generated SQL once in the Supabase SQL editor. Keep it out of git (the *.local.sql pattern is ignored).
// Refresh once per semester: running it again is safe, existing codes are skipped and waiting students are approved.
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const DEFAULT_URL = 'https://iiitd.ac.in/people/btech'

/** The four batches currently enrolled (1st to 4th year). A new batch joins in the second half of the year. */
export function currentBatches(now = new Date()) {
  const latest = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return { first: latest - 3, last: latest }
}

/** Extracts five-digit codes for batches first..last from the page HTML; returns { codes, perBatch }. */
export function extractCodes(html, first, last) {
  const text = html
    .replace(/<[^>]+>/g, '|')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
  // A table row reads: serial | roll number | name | program. The name and program are matched only to avoid
  // picking up stray numbers elsewhere on the page, and are not retained.
  const row = /\|\s*\d{1,4}\s*\|+\s*(20\d{2})(\d{3})\s*\|+\s*[^|]+?\s*\|+\s*[A-Za-z&\- ]{2,12}?\s*\|/g
  const codes = new Set()
  const perBatch = {}
  for (const m of text.matchAll(row)) {
    const year = Number(m[1])
    if (year < first || year > last) continue
    const code = m[1].slice(2) + m[2]
    if (!codes.has(code)) perBatch[year] = (perBatch[year] ?? 0) + 1
    codes.add(code)
  }
  return { codes: [...codes].sort(), perBatch }
}

export function toSql(codes, source, date = new Date()) {
  if (!codes.every((c) => /^[0-9]{5}$/.test(c))) throw new Error('Refusing to write anything but five-digit codes.')
  const lines = []
  for (let i = 0; i < codes.length; i += 12) lines.push(codes.slice(i, i + 12).map((c) => `('${c}')`).join(','))
  return [
    `-- Student codes from ${source} on ${date.toISOString().slice(0, 10)}. ${codes.length} five-digit codes (joining year + serial), no names.`,
    '-- Run once in the Supabase SQL editor. Do not commit this file.',
    'insert into public.student_codes (code) values',
    lines.join(',\n'),
    'on conflict do nothing;',
    'select public.approve_listed_students() as newly_approved;',
    '',
  ].join('\n')
}

const AGENT = 'iiitd-black-market student-code loader (public page, numbers only)'

/**
 * Reads the page with certificate checking ON. The institute's server sends an incomplete certificate chain that
 * Node's fetch rejects but the operating system's curl completes, so fall back to curl rather than disabling TLS checks.
 */
export async function readPage(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (first) {
    try {
      return execFileSync('curl', ['-fsSL', '--max-time', '60', '-A', AGENT, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    } catch { throw new Error(`Could not read ${url} (${first.cause?.code ?? first.message}).`) }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
  const dry = args.includes('--dry-run')
  const url = flag('--url', DEFAULT_URL)
  const out = flag('--out', 'student-codes.local.sql')
  const min = Number(flag('--min', '200'))
  const range = flag('--batches')
  const { first, last } = range ? { first: Number(range.split('-')[0]), last: Number(range.split('-')[1]) } : currentBatches()
  if (!(first >= 2000 && last >= first && last - first <= 8)) throw new Error('Use --batches like 2023-2026.')

  const { codes, perBatch } = extractCodes(await readPage(url), first, last)
  console.log(`Batches ${first}-${last}: ${codes.length} codes`, perBatch)
  // A layout change on the page would show up as a sudden drop; never write a suspiciously small list.
  if (codes.length < min) throw new Error(`Only ${codes.length} codes found (expected at least ${min}). The page layout may have changed; nothing written.`)
  if (dry) return console.log('Dry run: nothing written.')
  await writeFile(out, toSql(codes, url), { mode: 0o600 })
  console.log(`Wrote ${out} (codes only). Run it once in the Supabase SQL editor; do not commit it.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((e) => { console.error(e.message); process.exit(1) })
