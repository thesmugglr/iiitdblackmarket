import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Local PostgreSQL behaviour for migration 0009 (owner-requested features). Not a substitute for live Supabase QA:
// pg_net, Storage and the Edge Function are absent here.
test('0009: saved alerts, deals and thumbs-up, lost & found, push and account deletion', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
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
    -- Supabase gives the API roles access to new tables and functions by default; the migrations then narrow it.
    grant usage on schema public, auth, storage to authenticated, anon;
    grant all on all tables in schema storage to authenticated, anon;
    alter default privileges in schema public grant all on tables to authenticated, anon;
    alter default privileges in schema public grant execute on functions to authenticated, anon;
  `)
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
    let sql = await readFile(new URL(name, dir), 'utf8')
    if (name === '0001_init.sql') sql = sql.replace('create extension if not exists pgcrypto;', '')
    await db.exec(sql)
  }

  const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const [seller, buyer, saver, other, pending] = [11, 12, 13, 14, 15].map(id)
  for (const [uid, name] of [[seller, 'seller'], [buyer, 'buyer'], [saver, 'saver'], [other, 'other'], [pending, 'pending']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [uid, `${name}@iiitd.ac.in`])
  }
  await db.query("update profiles set status = 'approved' where id <> $1", [pending])

  const as = async (uid) => {
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid])
  }
  const asAnon = async () => {
    await db.exec('reset role; set role anon')
    await db.query("select set_config('request.jwt.claim.sub','',false)")
  }
  const asOwner = async () => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub','',false)")
  }
  const rows = async (q, p = []) => (await db.query(q, p)).rows
  const scalar = async (q, p = []) => Object.values((await db.query(q, p)).rows[0] ?? {})[0]
  const noticesOf = async (uid) => { await as(uid); return rows('select kind, title, link from notifications order by created_at') }

  await as(seller)
  const kettle = await scalar(`insert into listings(seller_id,title,listing_type,category,condition,price_inr) values($1,'Kettle','sale','hostel','good',500) returning id`, [seller])
  const lamp = await scalar(`insert into listings(seller_id,title,listing_type,category,condition,price_inr) values($1,'Lamp','sale','hostel','good',200) returning id`, [seller])
  for (const uid of [saver, buyer]) { await as(uid); await db.query('insert into saved_items(user_id,listing_id) values($1,$2)', [uid, kettle]) }
  let conversation

  await t.test('listing shares respect expiry before creating a message request', async () => {
    await as(seller)
    const listing = await scalar(`insert into listings(seller_id,title,listing_type,category,condition,expires_at)
      values($1,'Desk lamp','sale','hostel','good',now()-interval '1 day') returning id`, [seller])
    await as(buyer)
    await assert.rejects(db.query('select share_listing($1,$2)', [listing, other]), /Listing unavailable/)
    await as(seller)
    await db.query("update listings set expires_at=now()+interval '1 day' where id=$1", [listing])
    await as(buyer)
    assert.ok(await scalar('select share_listing($1,$2)', [listing, other]))
  })

  await t.test('a price drop alerts people who saved the item, not the seller, and a rise does not', async () => {
    await as(seller)
    await db.query('update listings set price_inr = 400 where id = $1', [kettle])
    const saverNotices = await noticesOf(saver)
    assert.deepEqual(saverNotices.map((n) => [n.kind, n.title, n.link]), [['price_drop', '"Kettle" dropped to ₹400', `/listing/${kettle}`]])
    assert.equal((await noticesOf(seller)).length, 0)
    await as(saver)
    await db.query('update notifications set read_at = now()')
    await as(seller)
    await db.query('update listings set price_inr = 450 where id = $1', [kettle])
    assert.equal((await noticesOf(saver)).filter((n) => n.kind === 'price_drop').length, 1)
  })

  await t.test('reserving tells other savers, but not the buyer whose offer was accepted', async () => {
    await as(buyer)
    conversation = await scalar('select start_conversation($1)', [kettle])
    const offer = await scalar('select make_offer($1, 350)', [conversation])
    await as(seller)
    await db.query('select respond_offer($1, true)', [offer])
    assert.ok((await noticesOf(saver)).some((n) => n.kind === 'saved_sold' && n.title === '"Kettle" was just reserved'))
    assert.ok(!(await noticesOf(buyer)).some((n) => n.kind === 'saved_sold'))
  })

  await t.test('only the seller can mark an item sold to the buyer, and only once', async () => {
    await as(buyer)
    await assert.rejects(db.query('select mark_sold_to($1)', [conversation]), /Only the seller/)
    await as(seller)
    await scalar('select mark_sold_to($1)', [conversation])
    assert.equal(await scalar('select status from listings where id = $1', [kettle]), 'sold')
    const [deal] = await rows('select seller_id, buyer_id, amount_inr, title, smooth from deals')
    assert.deepEqual(deal, { seller_id: seller, buyer_id: buyer, amount_inr: 350, title: 'Kettle', smooth: null })
    assert.match(await scalar('select body from messages where conversation_id = $1 order by created_at desc limit 1', [conversation]), /Marked this as sold to you/)
    await assert.rejects(db.query('select mark_sold_to($1)', [conversation]), /cannot be marked sold|already/)
    await assert.rejects(db.query("insert into deals(seller_id,buyer_id,title) values($1,$2,'Forged')", [seller, buyer]), /permission denied/)
  })

  await t.test('only the buyer rates the deal; a retry is harmless and a change of mind is refused', async () => {
    await as(seller)
    await assert.rejects(db.query('select rate_deal($1, true)', [conversation]), /no deal to rate/)
    await as(buyer)
    await db.query('select rate_deal($1, true)', [conversation])
    await db.query('select rate_deal($1, true)', [conversation])
    await assert.rejects(db.query('select rate_deal($1, false)', [conversation]), /already rated/)
    await as(other)
    assert.equal(await scalar('select smooth_deals($1)', [seller]), 1)
    assert.equal(await scalar('select count(*)::int from deals'), 0, 'other students see the count, not the deals')
    await as(pending)
    assert.equal(await scalar('select smooth_deals($1)', [seller]), 0)
  })

  let post
  await t.test('lost & found replies stay between the poster and each person who writes', async () => {
    await as(other)
    post = await scalar(`insert into lost_found(user_id,kind,title,place) values($1,'lost','Blue water bottle','Library') returning id`, [other])
    await assert.rejects(db.query(`insert into lost_found(user_id,kind,title,place,photo) values($1,'found','Keys','Mess',$2)`, [other, `${buyer}/keys.jpg`]), /check constraint/)
    await assert.rejects(db.query(`insert into lost_found(user_id,kind,title) values($1,'found','Keys')`, [other]), /null value|not-null/, 'where is required')
    await assert.rejects(db.query(`insert into lost_found(user_id,kind,title,place) values($1,'found','Keys',' ')`, [other]), /check constraint/, 'a blank place is refused')
    await as(pending)
    assert.equal(await scalar('select count(*)::int from lost_found'), 0)
    await as(buyer)
    await scalar('select reply_lost_found($1, $2)', [post, 'I think I saw it near the mess'])
    assert.ok((await noticesOf(other)).some((n) => n.kind === 'lost_found' && n.link === `/lost-found?post=${post}`))
    await as(other)
    assert.equal(await scalar('select count(*)::int from lost_found_replies'), 1)
    await scalar('select reply_lost_found($1, $2, $3)', [post, 'Thanks! Can I collect it today?', buyer])
    await assert.rejects(db.query('select reply_lost_found($1, $2, $3)', [post, 'Hello?', saver]), /Choose who/)
    await as(buyer)
    assert.equal(await scalar('select count(*)::int from lost_found_replies'), 2)
    await as(saver)
    assert.equal(await scalar('select count(*)::int from lost_found_replies'), 0)
    await db.query('insert into blocks(blocker_id, blocked_id) values($1, $2)', [saver, other])
    await assert.rejects(db.query('select reply_lost_found($1, $2)', [post, 'Mine?']), /Unable to reply/)
    await assert.rejects(db.query('insert into lost_found_replies(post_id,sender_id,recipient_id,body) values($1,$2,$3,$4)', [post, saver, other, 'x']), /permission denied/)
    await as(other)
    await db.query("update lost_found set status = 'resolved' where id = $1", [post])
    await as(buyer)
    await assert.rejects(db.query('select reply_lost_found($1, $2)', [post, 'Still there?']), /closed/)
    assert.equal(await scalar('select count(*)::int from lost_found where id = $1', [post]), 0)
  })

  await t.test('push subscriptions: own rows only, one owner per browser, secret-gated delivery data', async () => {
    const endpoint = 'https://push.example.test/sub/abc'
    const key = 'B' + 'x'.repeat(86)
    const auth = 'y'.repeat(22)
    await as(buyer)
    assert.equal(await scalar('select push_public_key()'), null, 'push stays off until the function is configured')
    await db.query('select save_push_subscription($1, $2, $3)', [endpoint, key, auth])
    assert.equal(await scalar('select count(*)::int from push_subscriptions'), 1)
    await as(saver)
    assert.equal(await scalar('select count(*)::int from push_subscriptions'), 0)
    await db.query('select save_push_subscription($1, $2, $3)', [endpoint, key, auth])
    await as(buyer)
    assert.equal(await scalar('select count(*)::int from push_subscriptions'), 0, 'the browser moved to the account now using it')
    await assert.rejects(db.query('select push_payload($1, $2)', [conversation, 'guess']), /permission denied/)
    await asAnon()
    await assert.rejects(db.query('select * from push_config'), /permission denied/)
    await assert.rejects(db.query('select push_payload($1, $2)', [conversation, 'guess']), /Not allowed/)
    await asOwner()
    const secret = await scalar('select secret from push_config')
    assert.match(secret, /^[0-9a-f]{64}$/)
    const notice = await scalar("insert into notifications(user_id, kind, title, link) values($1, 'message', 'New message about Lamp', '/inbox/x') returning id", [saver])
    await asAnon()
    const payload = await scalar('select push_payload($1, $2)', [notice, secret])
    assert.deepEqual(payload, { title: 'New message about Lamp', link: '/inbox/x', kind: 'message', subscriptions: [{ endpoint, p256dh: key, auth }] })
    assert.equal(await scalar('select push_prune($1, $2)', [secret, [endpoint]]), 1)
    await asOwner()
    assert.equal(await scalar('select count(*)::int from push_subscriptions'), 0)
    // With the function configured but no pg_net here, notifications must still be saved.
    await db.query("update push_config set function_url = 'https://example.test/functions/v1/push', vapid_public_key = 'BPUBLIC'")
    await as(buyer)
    await db.query('select save_push_subscription($1, $2, $3)', [endpoint, key, auth])
    await asOwner()
    await db.query("select notify($1, 'message', 'Still saved', '/inbox/y')", [buyer])
    assert.equal(await scalar("select count(*)::int from notifications where title = 'Still saved'"), 1)
    await as(buyer)
    assert.equal(await scalar('select push_public_key()'), 'BPUBLIC')
    await as(pending)
    assert.equal(await scalar('select push_public_key()'), null)
  })

  await t.test('deleting an account removes the person and their data but keeps the seller\'s rating', async () => {
    // A report about one of the deleting person's messages must not block the deletion.
    await as(other)
    const chat = await scalar('select start_conversation($1)', [lamp])
    const message = await scalar("insert into messages(conversation_id, sender_id, body) values($1, $2, 'Is it still there?') returning id", [chat, other])
    await as(seller)
    await db.query("insert into reports(reporter_id, message_id, reason) values($1, $2, 'Spam message')", [seller, message])
    await as(other)
    await db.query('select delete_my_account()')
    await as(buyer)
    await db.query('select delete_my_account()')
    await asOwner()
    assert.equal(await scalar('select count(*)::int from auth.users where id = any($1)', [[other, buyer]]), 0)
    assert.equal(await scalar('select count(*)::int from profiles where id = any($1)', [[other, buyer]]), 0)
    assert.equal(await scalar('select count(*)::int from lost_found'), 0)
    assert.equal(await scalar('select count(*)::int from conversations'), 0)
    assert.equal(await scalar('select count(*)::int from push_subscriptions'), 0)
    assert.deepEqual(await rows('select buyer_id, smooth from deals'), [{ buyer_id: null, smooth: true }])
    assert.equal(await scalar('select count(*)::int from profiles where id = $1', [seller]), 1)
    await as(saver)
    assert.equal(await scalar('select smooth_deals($1)', [seller]), 1)
    await as(pending)
    await db.query('select delete_my_account()')
    await asAnon()
    await assert.rejects(db.query('select delete_my_account()'), /permission denied/)
  })
})
