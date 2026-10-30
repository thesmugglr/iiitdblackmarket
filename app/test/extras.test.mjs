import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Local PostgreSQL behavior for EXTRA-01..03, not a substitute for live Supabase QA.
test('extras: wanted posts, bundles, expiry and notifications', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(name,'/') $$;
    create publication supabase_realtime;
  `);
  const sql = (f) => readFile(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
  await db.exec((await sql('0001_init.sql')).replace('create extension if not exists pgcrypto;', ''));
  await db.exec(`grant usage on schema public,auth,storage to authenticated,anon;
    grant all on all tables in schema public,storage to authenticated,anon;`);
  await db.exec(await sql('0002_review_access.sql'));
  await db.exec(await sql('0003_extras.sql'));
  // Supabase grants new tables to API roles by default; mirror that (notifications keeps the migration's column-only update grant).
  await db.exec(`grant all on public.wanted_posts,public.wanted_responses,public.bundles,public.bundle_items to authenticated;
    grant select,insert,delete on public.notifications to authenticated;`);
  const seller = '00000000-0000-0000-0000-000000000002';
  const buyer = '00000000-0000-0000-0000-000000000003';
  const as = async (id) => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const scalar = async (q, p = []) => Object.values((await db.query(q, p)).rows[0])[0];
  for (const [id, n] of [[seller, 'seller'], [buyer, 'buyer']]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${n}@iiitd.ac.in`]);
  await db.query("update profiles set status='approved'");
  await as(seller);
  const mk = (title) => scalar(`insert into listings(seller_id,title,listing_type,category,condition,price_inr) values($1,$2,'sale','hostel','good',100) returning id`, [seller, title]);
  const l1 = await mk('Kettle'), l2 = await mk('Lamp');

  await t.test('bundle needs 2+ own active listings and can be sold', async () => {
    await assert.rejects(db.query("select create_bundle('One','',100,$1)", [[l1]]), /2 to 10/);
    await as(buyer);
    await assert.rejects(db.query("select create_bundle('Steal','',100,$1)", [[l1, l2]]), /2 to 10/);
    await as(seller);
    const b = await scalar("select create_bundle('Hostel kit','',150,$1)", [[l1, l2]]);
    await as(buyer);
    assert.equal((await db.query('select * from bundle_items where bundle_id=$1', [b])).rows.length, 2);
    await assert.rejects(db.query('select mark_bundle_sold($1)', [b]), /cannot/);
    await as(seller);
    await db.query('select mark_bundle_sold($1)', [b]);
    assert.equal(await scalar("select status from listings where id=$1", [l1]), 'sold');
  });

  await t.test('wanted responses notify the poster only', async () => {
    await as(buyer);
    const post = await scalar(`insert into wanted_posts(user_id,title,category) values($1,'Need a kettle','hostel') returning id`, [buyer]);
    await as(seller);
    const l3 = await mk('Kettle 2');
    await assert.rejects(db.query('select respond_wanted($1,$2)', [post, l1]), /active listings/);
    await db.query('select respond_wanted($1,$2)', [post, l3]);
    assert.equal((await db.query('select * from notifications where user_id=$1', [seller])).rows.length, 0);
    await as(buyer);
    assert.equal((await db.query("select * from notifications where kind='wanted'")).rows.length, 1);
    await assert.rejects(db.query("update notifications set title='x'"), /permission denied/);
    await db.query('select mark_all_notifications_read()');
    assert.equal((await db.query('select * from notifications where read_at is null')).rows.length, 0);
  });

  await t.test('expired listings hide from others, remind once, and can be renewed', async () => {
    await as(seller);
    const l4 = await mk('Fan');
    await db.exec("reset role");
    await db.query("update listings set expires_at = now() + interval '1 day' where id=$1", [l4]);
    await as(seller);
    await db.query('select refresh_expiry_notices()');
    await db.query('select refresh_expiry_notices()');
    assert.equal((await db.query("select * from notifications where kind='expiry'")).rows.length, 1);
    await db.exec('reset role');
    await db.query("update listings set expires_at = now() - interval '1 day' where id=$1", [l4]);
    await as(buyer);
    assert.equal((await db.query('select * from listings where id=$1', [l4])).rows.length, 0);
    await as(seller);
    assert.equal((await db.query('select * from listings where id=$1', [l4])).rows.length, 1);
    await db.query('select renew_listing($1)', [l4]);
    await as(buyer);
    assert.equal((await db.query('select * from listings where id=$1', [l4])).rows.length, 1);
  });

  await t.test('messages notify the other participant once', async () => {
    await as(buyer);
    const kettle2 = await scalar("select id from listings where title='Kettle 2'");
    const conv = await scalar('select start_conversation($1)', [kettle2]);
    await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'hi')", [conv, buyer]);
    await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'hello?')", [conv, buyer]);
    await as(seller);
    assert.equal((await db.query("select * from notifications where kind='message'")).rows.length, 1);
  });
});
