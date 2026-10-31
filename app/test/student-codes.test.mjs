import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Local PostgreSQL behavior for number-only student approval (0007), not a substitute for live Supabase QA.
test('student codes: approve by the numeric part of the institute address', async (t) => {
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

  const id = (n) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
  const as = async (uid, role = 'authenticated') => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
  };
  const trusted = async () => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); };
  // Google sign-ups carry the provider marker at insert; GoTrue confirms the email in a follow-up update.
  const insertUser = (uid, email, { provider = 'email', confirmed = false } = {}) =>
    db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,$3,$4)',
      [uid, email, confirmed ? new Date().toISOString() : null, JSON.stringify({ provider, providers: [provider] })]);
  const confirm = (uid) => db.query('update auth.users set email_confirmed_at = now() where id = $1', [uid]);
  const status = async (uid) => (await db.query('select role,status from profiles where id=$1', [uid])).rows[0];

  await db.query("insert into admin_bootstrap(email) values ('owner@iiitd.ac.in')");
  await insertUser(id(1), 'owner@iiitd.ac.in', { provider: 'google' });
  await db.query("insert into student_codes(code) values ('25025'),('24001'),('26999')");

  await t.test('only five-digit codes can be stored', async () => {
    await assert.rejects(db.query("insert into student_codes(code) values ('2502')"), /check/i);
    await assert.rejects(db.query("insert into student_codes(code) values ('abcde')"), /check/i);
  });
  await t.test('a listed code on a Google-verified address is approved at sign-up', async () => {
    await insertUser(id(2), 'Abhik25025@iiitd.ac.in', { provider: 'google' });
    assert.deepEqual(await status(id(2)), { role: 'student', status: 'approved' });
    await insertUser(id(3), 'a.b-c_d24001@iiitd.ac.in', { provider: 'google' });
    assert.deepEqual(await status(id(3)), { role: 'student', status: 'approved' });
  });
  await t.test('insert-then-confirm order (GoTrue) also approves a listed code', async () => {
    await insertUser(id(4), 'someone26999@iiitd.ac.in');
    assert.deepEqual(await status(id(4)), { role: 'student', status: 'pending' });
    await confirm(id(4));
    assert.deepEqual(await status(id(4)), { role: 'student', status: 'approved' });
  });
  await t.test('unlisted codes and look-alike addresses stay pending', async () => {
    for (const [n, email] of [[5, 'newbie25026@iiitd.ac.in'], [6, 'faculty@iiitd.ac.in'], [7, 'abhik2502@iiitd.ac.in'],
      [8, 'abhik250250@iiitd.ac.in'], [9, '25025@iiitd.ac.in'], [10, 'abhik25025x@iiitd.ac.in'], [11, 'abhik25025.2@iiitd.ac.in']]) {
      await insertUser(id(n), email, { provider: 'google' });
      assert.deepEqual(await status(id(n)), { role: 'student', status: 'pending' }, email);
    }
  });
  await t.test('an unverified address never gains approval from a listed code', async () => {
    await insertUser(id(12), 'spoof24001@iiitd.ac.in');
    assert.deepEqual(await status(id(12)), { role: 'student', status: 'pending' });
  });
  await t.test('client-editable metadata cannot impersonate provider verification or trigger approval', async () => {
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values($1,$2,null,$3,$4)',
      [id(13), 'metadata24001@iiitd.ac.in', JSON.stringify({ provider: 'google', email_verified: true, status: 'approved', role: 'admin' }), JSON.stringify({ provider: 'email' })]);
    assert.deepEqual(await status(id(13)), { role: 'student', status: 'pending' });
    await as(id(13));
    await assert.rejects(db.query('select approve_listed_students()'), /permission denied/);
    await trusted();
    await db.query('select approve_listed_students()');
    assert.deepEqual(await status(id(13)), { role: 'student', status: 'pending' });
  });
  await t.test('listed students do not trigger admin alerts but unlisted ones do', async () => {
    await as(id(1));
    const alerts = (await db.query("select count(*)::int as n from notifications where kind='approval'")).rows[0].n;
    assert.equal(alerts, 1, 'one unread approval alert in total');
    await trusted();
  });
  await t.test('approve_listed_students approves only pending listed students', async () => {
    await insertUser(id(20), 'late24001@iiitd.ac.in');          // listed code but never verified: must not be approved
    await insertUser(id(21), 'wait25555@iiitd.ac.in', { provider: 'google' });
    await insertUser(id(22), 'gone25556@iiitd.ac.in', { provider: 'google' });
    await db.query("update profiles set status='suspended' where id=$1", [id(22)]);
    await db.query("insert into student_codes(code) values ('25555'),('25556')");
    const n = (await db.query('select approve_listed_students() as n')).rows[0].n;
    assert.equal(n, 1, 'only the verified, waiting student is approved');
    assert.equal((await status(id(21))).status, 'approved');
    assert.equal((await status(id(20))).status, 'pending', 'unverified sign-ups are never approved by the helper');
    assert.equal((await status(id(12))).status, 'pending');
    assert.equal((await status(id(22))).status, 'suspended', 'suspended accounts are never re-approved');
    assert.equal((await status(id(1))).role, 'admin');
  });
  await t.test('API roles cannot read the codes or call the helper functions', async () => {
    await as(id(2));
    await assert.rejects(db.query('select * from student_codes'), /permission denied/);
    await assert.rejects(db.query("insert into student_codes(code) values ('11111')"), /permission denied/);
    await assert.rejects(db.query('select approve_listed_students()'), /permission denied/);
    await assert.rejects(db.query("select is_listed_student('abhik25025@iiitd.ac.in')"), /permission denied/);
    await as(null, 'anon');
    await assert.rejects(db.query('select * from student_codes'), /permission denied/);
    await assert.rejects(db.query('select approve_listed_students()'), /permission denied/);
    await assert.rejects(db.query("select is_listed_student('abhik25025@iiitd.ac.in')"), /permission denied/);
    await trusted();
  });
  await t.test('re-running the idempotent logic block changes nothing', async () => {
    const s = await sql('0007_student_codes.sql');
    const block = s.slice(s.indexOf('-- BEGIN STUDENT CODE LOGIC'), s.indexOf('-- END STUDENT CODE LOGIC'));
    await db.exec(block);
    await insertUser(id(30), 'again24001@iiitd.ac.in', { provider: 'google' });
    assert.equal((await status(id(30))).status, 'approved');
  });
});
