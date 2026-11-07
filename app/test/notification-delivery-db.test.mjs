import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('notification delivery and bounded conversation reads',async t=>{
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


const seller='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
for(const [id,name] of [[seller,'seller'],[buyer,'buyer'],[other,'other']])await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@iiitd.ac.in`]);
await db.exec("update profiles set status='approved'");
const owner=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)")};
const as=async id=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
await as(seller);
const listing=await scalar("insert into listings(seller_id,title,listing_type,category,condition,price_inr) values($1,'Test item','sale','misc','good',20) returning id",[seller]);
await as(buyer);const conv=await scalar('select start_conversation($1)',[listing]);
const send=async body=>{await as(buyer);return scalar('insert into messages(conversation_id,sender_id,body) values($1,$2,$3) returning id',[conv,buyer,body])};
const first=await send('First');await as(seller);
const before=await scalar('select created_at::text from notifications');
const second=await send('Second');await as(seller);
assert.equal(await scalar('select count(*)::int from notifications'),1);
assert.notEqual(await scalar('select created_at::text from notifications'),before);
await db.query('select mark_conversation_seen($1,$2)',[conv,[first]]);
assert.equal(await scalar('select count(*)::int from notifications where read_at is null'),1,'unseen message keeps alert unread');
assert.equal(await scalar('select count(*)::int from messages where read_at is null'),1);
await db.query('select mark_conversation_seen($1,$2)',[conv,[first,second]]);
assert.equal(await scalar('select count(*)::int from notifications where read_at is null'),0);
await as(other);await assert.rejects(db.query('select mark_conversation_seen($1,$2)',[conv,[first]]),/unavailable/);
await as(seller);const keys=['B'+'x'.repeat(86),'y'.repeat(22)];
await db.query("select save_push_subscription('https://example.test/sub',$1,$2)",keys);
assert.equal(await scalar("select push_subscription_registered('https://example.test/sub',$1,$2)",keys),true);
await as(buyer);assert.equal(await scalar("select push_subscription_registered('https://example.test/sub',$1,$2)",keys),false);
await owner();
await db.exec("create schema net; create table net.requests(id bigserial primary key); create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ declare n bigint; begin insert into net.requests default values returning id into n;return n;end $$; update push_config set function_url='https://example.test/push';");
await send('Third');await owner();assert.equal(await scalar('select count(*)::int from net.requests'),1);
await send('Fourth');await owner();assert.equal(await scalar('select count(*)::int from net.requests'),1,'burst throttled');
await db.exec("update notifications set push_requested_at=now()-interval '20 seconds'");
await send('Fifth');await owner();assert.equal(await scalar('select count(*)::int from net.requests'),2,'later grouped event dispatches again');
})
