import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

test('idempotent offer RPCs preserve authorization and existing lifecycle rules', async t => {
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
  const seller = randomUUID(), buyer = randomUUID(), other = randomUUID()
  for (const [id, name] of [[seller, 'seller'], [buyer, 'buyer'], [other, 'other']]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}.offer-fixture@iiitd.ac.in`])
  await db.exec("update profiles set status='approved'")
  const as = async (id, role = 'authenticated') => {
    await db.exec(`reset role; set role ${role}`)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ''])
  }
  const owner = () => as(null, 'none')
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
  const fixture = async () => {
    await as(seller)
    const listing = await scalar("insert into listings(seller_id,title,listing_type,category,condition,price_inr) values($1,'Offer fixture','sale','hostel','good',500) returning id", [seller])
    await as(buyer)
    const conversation = await scalar('select start_conversation($1)', [listing])
    return { listing, conversation, request: randomUUID() }
  }
  const make = (f, amount = 300, id = f.request) => scalar('select make_offer_once($1,$2,$3)', [f.conversation, amount, id])
  const respond = (id, accept) => scalar('select respond_offer_once($1,$2)', [id, accept])
  const messages = f => scalar('select count(*)::integer from messages where conversation_id=$1', [f.conversation])

  await t.test('new functions deny anonymous execution and keep legacy RPCs available', async () => {
    await owner()
    for (const signature of ['make_offer_once(uuid,integer,uuid)', 'respond_offer_once(uuid,boolean)']) {
      assert.equal(await scalar("select has_function_privilege('anon',$1,'execute')", [signature]), false)
      assert.equal(await scalar("select has_function_privilege('authenticated',$1,'execute')", [signature]), true)
    }
    assert.ok(await scalar("select to_regprocedure('make_offer(uuid,integer)') is not null"))
    assert.ok(await scalar("select to_regprocedure('respond_offer(uuid,boolean)') is not null"))
  })

  await t.test('same request produces one offer/message; changed amounts cannot overwrite it', async () => {
    const f = await fixture()
    assert.equal(await make(f), f.request)
    assert.equal(await make(f), f.request)
    await assert.rejects(make(f, 301), /does not match/)
    assert.equal(await scalar('select count(*)::integer from offers where conversation_id=$1', [f.conversation]), 1)
    assert.equal(await scalar('select amount_inr from offers where id=$1', [f.request]), 300)
    assert.equal(await messages(f), 1)
  })

  await t.test('request IDs cannot be reused for a different conversation', async () => {
    const first = await fixture()
    await make(first)
    const second = await fixture()
    await assert.rejects(make(second, 300, first.request), /does not match/)
    assert.equal(await messages(second), 0)
  })

  await t.test('a prior commit can be confirmed after expiry; a new request cannot create an expired offer', async () => {
    const f = await fixture()
    await make(f)
    await owner()
    await db.query("update listings set expires_at=now()-interval '1 day' where id=$1", [f.listing])
    await as(buyer)
    assert.equal(await make(f), f.request)
    await assert.rejects(make(f, 300, randomUUID()), /Offers not possible/)
    assert.equal(await messages(f), 1)
  })

  await t.test('non-buyers, blocked/suspended members and anonymous callers cannot create offers', async () => {
    const f = await fixture()
    for (const id of [seller, other]) { await as(id); await assert.rejects(make(f)) }
    await as(null, 'anon')
    await assert.rejects(make(f), /permission denied/)
    await owner()
    await db.query("update profiles set status='suspended' where id=$1", [buyer])
    await as(buyer)
    await assert.rejects(make(f), /Conversation unavailable/)
    await owner()
    await db.query("update profiles set status='approved' where id=$1", [buyer])
    await db.query('insert into blocks(blocker_id,blocked_id) values($1,$2)', [seller, buyer])
    await as(buyer)
    await assert.rejects(make(f), /Conversation unavailable/)
    await owner()
    await db.query('delete from blocks where blocker_id=$1 and blocked_id=$2', [seller, buyer])
    assert.equal(await scalar('select count(*)::integer from offers where conversation_id=$1', [f.conversation]), 0)
  })

  await t.test('reserved, removed and giveaway listings reject new requests', async () => {
    const f = await fixture()
    for (const status of ['reserved', 'removed']) {
      await owner(); await db.query('update listings set status=$1 where id=$2', [status, f.listing])
      await as(buyer); await assert.rejects(make(f), /Offers not possible/)
    }
    await owner(); await db.query("update listings set status='active',listing_type='giveaway',price_inr=0 where id=$1", [f.listing])
    await as(buyer); await assert.rejects(make(f), /Offers not possible/)
    assert.equal(await messages(f), 0)
  })

  await t.test('accept retry emits one response and cannot reverse a later sold state or price', async () => {
    const f = await fixture()
    await make(f)
    const competing = randomUUID()
    await make(f, 400, competing)
    await as(seller)
    await respond(f.request, true)
    await respond(f.request, true)
    await assert.rejects(respond(f.request, false), /different response/)
    assert.equal(await scalar('select status from offers where id=$1', [competing]), 'declined')
    assert.deepEqual((await db.query('select status,price_inr from listings where id=$1', [f.listing])).rows[0], { status: 'reserved', price_inr: 300 })
    assert.equal(await messages(f), 3)
    await owner(); await db.query("update listings set status='sold',price_inr=999 where id=$1", [f.listing])
    await as(seller); await respond(f.request, true)
    assert.deepEqual((await db.query('select status,price_inr from listings where id=$1', [f.listing])).rows[0], { status: 'sold', price_inr: 999 })
    assert.equal(await messages(f), 3)
  })

  await t.test('decline retry is idempotent; a later acceptance cannot undo it', async () => {
    const f = await fixture(); await make(f)
    await as(seller); await respond(f.request, false); await respond(f.request, false)
    await assert.rejects(respond(f.request, true), /different response/)
    assert.equal(await messages(f), 2)
    assert.equal(await scalar('select status from listings where id=$1', [f.listing]), 'active')
  })

  await t.test('response retries still require the current approved, unblocked seller', async () => {
    const f = await fixture(); await make(f)
    await assert.rejects(respond(f.request, true), /Only the seller/)
    await as(other); await assert.rejects(respond(f.request, true))
    await owner(); await db.query("update profiles set status='suspended' where id=$1", [seller])
    await as(seller); await assert.rejects(respond(f.request, true), /Conversation unavailable/)
    await owner(); await db.query("update profiles set status='approved' where id=$1", [seller])
    await db.query('insert into blocks(blocker_id,blocked_id) values($1,$2)', [buyer, seller])
    await as(seller); await assert.rejects(respond(f.request, true), /Conversation unavailable/)
    await owner(); await db.query('delete from blocks where blocker_id=$1 and blocked_id=$2', [buyer, seller])
    assert.equal(await scalar('select status from offers where id=$1', [f.request]), 'pending')
  })

  await t.test('acceptance retains expiry/removal checks; invalid requests have no side effects', async () => {
    const f = await fixture(); await make(f)
    await owner(); await db.query("update listings set expires_at=now()-interval '1 day' where id=$1", [f.listing])
    await as(seller); await assert.rejects(respond(f.request, true), /Listing unavailable/)
    await assert.rejects(respond(f.request, null), /Response required/)
    await owner(); await db.query("update listings set expires_at=now()+interval '30 days',status='removed' where id=$1", [f.listing])
    await as(seller); await assert.rejects(respond(f.request, true), /Listing unavailable/)
    assert.equal(await scalar('select status from offers where id=$1', [f.request]), 'pending')
    assert.equal(await messages(f), 1)
    const fresh = await fixture()
    await assert.rejects(make(fresh, -1), /Invalid offer request/)
    await assert.rejects(make(fresh, 100, null), /Invalid offer request/)
    assert.equal(await messages(fresh), 0)
  })
})
