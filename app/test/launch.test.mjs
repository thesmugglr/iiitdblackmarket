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

  const owner = '00000000-0000-0000-0000-0000000000a1';
  const student = '00000000-0000-0000-0000-0000000000a2';
  const rostered = '00000000-0000-0000-0000-0000000000a3';
  const spoofed = '00000000-0000-0000-0000-0000000000a4';
  const as = async (id, role = 'authenticated') => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
  };
  // GoTrue inserts the user first and confirms the email afterwards, so the Google provider marker is what counts.
  const signUp = (id, email, verified = true) =>
    db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,null,$3)',
      [id, email, verified ? '{"provider":"google","providers":["google"]}' : '{"provider":"email","providers":["email"]}']);
  const profile = async (id) => (await db.query('select role,status from profiles where id=$1', [id])).rows[0];

  await db.query("insert into admin_bootstrap(email) values('owner@iiitd.ac.in')");
  await db.query("insert into student_roster(email) values('rostered@iiitd.ac.in')");

  await t.test('bootstrap email becomes an approved admin on first verified sign-in', async () => {
    await signUp(owner, 'Owner@iiitd.ac.in');
    assert.deepEqual(await profile(owner), { role: 'admin', status: 'approved' });
  });
  await t.test('rostered students are approved; others wait and the admin is alerted once', async () => {
    await signUp(rostered, 'rostered@iiitd.ac.in');
    assert.deepEqual(await profile(rostered), { role: 'student', status: 'approved' });
    await signUp(student, 'someone@iiitd.ac.in');
    assert.deepEqual(await profile(student), { role: 'student', status: 'pending' });
    await as(owner);
    const n = (await db.query("select title,link from notifications where kind='approval'")).rows;
    assert.equal(n.length, 1);
    assert.equal(n[0].link, '/admin');
    await as(student);
    assert.equal((await db.query('select * from notifications')).rows.length, 0);
  });
  await t.test('an unverified email never receives admin or roster privileges', async () => {
    await db.exec('reset role');
    await db.query("insert into admin_bootstrap(email) values('spoof@iiitd.ac.in')");
    await signUp(spoofed, 'spoof@iiitd.ac.in', false);
    assert.deepEqual(await profile(spoofed), { role: 'student', status: 'pending' });
  });
  await t.test('API roles cannot read or change the bootstrap list', async () => {
    await as(owner);
    await assert.rejects(db.query('select * from admin_bootstrap'), /permission denied/);
    await assert.rejects(db.query("insert into admin_bootstrap(email) values('me@iiitd.ac.in')"), /permission denied/);
    await as(null, 'anon');
    await assert.rejects(db.query('select * from admin_bootstrap'), /permission denied/);
  });
  await t.test('outside-domain accounts are still rejected and ping works for anon', async () => {
    await db.exec('reset role');
    await assert.rejects(signUp('00000000-0000-0000-0000-0000000000a9', 'x@gmail.com'), /Only @iiitd/);
    await as(null, 'anon');
    assert.ok((await db.query('select ping() as now')).rows[0].now);
  });
});
