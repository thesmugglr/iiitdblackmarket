import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { localDay, recordVisit, visitPlan } from '../src/lib/visits.ts'

const memory = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v) }, data }
}
const client = (error = null) => {
  const calls = []
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return { error } } }
}

test('visitPlan counts a device once per day and flags first-ever visits', () => {
  assert.deepEqual(visitPlan('2026-11-16', null, null), { send: true, newDevice: true })
  assert.deepEqual(visitPlan('2026-11-16', '2026-11-15', '2026-11-10'), { send: true, newDevice: false })
  assert.deepEqual(visitPlan('2026-11-16', '2026-11-16', '2026-11-10'), { send: false, newDevice: false })
})

test('recordVisit sends once a day, remembers success only, and never throws', async () => {
  const now = new Date(2026, 10, 16, 12, 0)
  const store = memory(), api = client()
  assert.equal(await recordVisit(api, store, now), true)
  assert.deepEqual(api.calls, [['record_visit', { p_new_device: true }]])
  assert.equal(store.data.smugglr_last_visit, localDay(now))
  assert.equal(await recordVisit(api, store, now), false)
  assert.equal(api.calls.length, 1)
  assert.equal(await recordVisit(api, store, new Date(2026, 10, 17, 9, 0)), true)
  assert.deepEqual(api.calls[1], ['record_visit', { p_new_device: false }])

  const failing = memory(), bad = client({ message: 'down' })
  assert.equal(await recordVisit(bad, failing, now), false)
  assert.equal(failing.data.smugglr_last_visit, undefined, 'a failed report is retried on the next load')
  assert.equal(await recordVisit({ rpc: async () => { throw new Error('offline') } }, memory(), now), false)
  assert.equal(await recordVisit(client(), undefined, now), false)
})

test('visit counter table and functions: adds to daily totals, hides them from everyone but admins', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    create publication supabase_realtime;
  `)
  const directory = new URL('../../supabase/migrations/', import.meta.url)
  const initial = await readFile(new URL('0001_init.sql', directory), 'utf8')
  await db.exec(initial.replace('create extension if not exists pgcrypto;', ''))
  await db.exec('grant usage on schema public,auth,storage to authenticated,anon; grant all on all tables in schema public,storage to authenticated,anon;')
  for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql') && n !== '0001_init.sql').sort()) await db.exec(await readFile(new URL(name, directory), 'utf8'))
  const admin = randomUUID(), member = randomUUID()
  for (const [id, name] of [[admin, 'admin'], [member, 'member']]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}.visit-fixture@iiitd.ac.in`])
  await db.exec("update profiles set status='approved'")
  await db.query("update profiles set role='admin' where id=$1", [admin])
  const as = async (id, role) => { await db.exec(`reset role; set role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']) }

  await as(null, 'anon')
  await db.query('select record_visit(true)')
  await db.query('select record_visit(false)')
  await db.query('select record_visit()')
  await assert.rejects(db.query('select * from site_visits'), /permission denied/)
  await assert.rejects(db.query('select * from visit_summary()'), /permission denied/)
  await as(member, 'authenticated')
  await assert.rejects(db.query('select * from site_visits'), /permission denied/)
  assert.equal((await db.query('select * from visit_summary()')).rows.length, 0, 'members see nothing')
  await db.query('select record_visit(true)')
  await as(admin, 'authenticated')
  const rows = (await db.query('select * from visit_summary()')).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].visitors, 4)
  assert.equal(rows[0].new_devices, 2)
  await assert.rejects(db.query('update site_visits set visitors=0'), /permission denied/)
})
