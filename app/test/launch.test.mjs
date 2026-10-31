import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Local PostgreSQL behavior for launch readiness (0006), not a substitute for live Supabase QA.
test('launch: first-admin bootstrap, approval alerts and keep-alive', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(name,'/') $$;
    create publication supabase_realtime;
  `);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const sql = (f) => readFile(new URL(f, directory), 'utf8');
  await db.exec((await sql('0001_init.sql')).replace('create extension if not exists pgcrypto;', ''));
  await db.exec(`grant usage on schema public,auth,storage to authenticated,anon;
    grant all on all tables in schema public,storage to authenticated,anon;`);
  for (const name of (await readdir(directory)).filter((n) => n.endsWith('.sql') && n !== '0001_init.sql').sort()) await db.exec(await sql(name));
  await db.exec('grant select,insert,delete on public.notifications to authenticated');

  const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
  const as = async (uid, role = 'authenticated') => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
  };
  // GoTrue inserts the user first and confirms the email in a follow-up update; Google sign-ups also carry the provider.
  const insertUser = (uid, email, { provider = 'email', confirmed = false } = {}) =>
    db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,$3,$4)',
      [uid, email, confirmed ? new Date().toISOString() : null, JSON.stringify({ provider, providers: [provider] })]);
  const confirm = (uid) => db.query('update auth.users set email_confirmed_at = now() where id = $1', [uid]);
  // Trusted SQL-editor / service access: no API role and no signed-in user.
  const trusted = async () => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); };
  const profile = async (uid) => (await db.query('select role,status from profiles where id=$1', [uid])).rows[0];
  const approvalAlerts = async (admin) => { await as(admin); const n = (await db.query("select link from notifications where kind='approval'")).rows; await trusted(); return n; };

  await db.query("insert into admin_bootstrap(email) values ('owner@iiitd.ac.in'),('late@iiitd.ac.in'),('spoof@iiitd.ac.in')");
  await db.query("insert into student_roster(email) values ('rostered@iiitd.ac.in'),('slow@iiitd.ac.in')");

  await t.test('bootstrap email becomes an approved admin when the provider marks the sign-up as Google', async () => {
    await insertUser(id(1), 'Owner@iiitd.ac.in', { provider: 'google' });
    assert.deepEqual(await profile(id(1)), { role: 'admin', status: 'approved' });
  });
  await t.test('insert-then-confirm order (how GoTrue creates users) also promotes bootstrap and roster emails', async () => {
    await insertUser(id(2), 'late@iiitd.ac.in');
    assert.deepEqual(await profile(id(2)), { role: 'student', status: 'pending' });
    await confirm(id(2));
    assert.deepEqual(await profile(id(2)), { role: 'admin', status: 'approved' });
    await insertUser(id(3), 'slow@iiitd.ac.in');
    await confirm(id(3));
    assert.deepEqual(await profile(id(3)), { role: 'student', status: 'approved' });
  });
  await t.test('rostered Google sign-ups are approved; others wait and each pending sign-up alerts the admin once', async () => {
    await insertUser(id(4), 'rostered@iiitd.ac.in', { provider: 'google' });
    assert.deepEqual(await profile(id(4)), { role: 'student', status: 'approved' });
    await insertUser(id(5), 'someone@iiitd.ac.in', { provider: 'google' });
    assert.deepEqual(await profile(id(5)), { role: 'student', status: 'pending' });
    await insertUser(id(6), 'another@iiitd.ac.in', { provider: 'google' });
    const alerts = await approvalAlerts(id(1));
    assert.equal(alerts.length, 1, 'one unread approval alert at a time');
    assert.equal(alerts[0].link, '/admin');
    await as(id(5));
    assert.equal((await db.query('select * from notifications')).rows.length, 0, 'students never see admin alerts');
    await trusted();
  });
  await t.test('an unverified email never receives admin or roster privileges, and confirming a non-listed email changes nothing', async () => {
    await trusted();
    await insertUser(id(7), 'spoof@iiitd.ac.in');
    assert.deepEqual(await profile(id(7)), { role: 'student', status: 'pending' });
    await confirm(id(5));
    assert.deepEqual(await profile(id(5)), { role: 'student', status: 'pending' });
    // An approved or suspended profile is never touched by a later confirmation.
    await db.query("update profiles set status='suspended' where id=$1", [id(3)]);
    await db.query("update auth.users set email_confirmed_at = null where id=$1", [id(3)]);
    await confirm(id(3));
    assert.equal((await profile(id(3))).status, 'suspended');
  });
  await t.test('API roles cannot read or change the bootstrap list', async () => {
    await as(id(1));
    await assert.rejects(db.query('select * from admin_bootstrap'), /permission denied/);
    await assert.rejects(db.query("insert into admin_bootstrap(email) values('me@iiitd.ac.in')"), /permission denied/);
    await as(null, 'anon');
    await assert.rejects(db.query('select * from admin_bootstrap'), /permission denied/);
  });
  await t.test('outside-domain accounts are still rejected and ping works for anon', async () => {
    await trusted();
    await assert.rejects(insertUser(id(9), 'x@gmail.com', { provider: 'google' }), /Only @iiitd/);
    await as(null, 'anon');
    assert.ok((await db.query('select ping() as now')).rows[0].now);
  });
});
