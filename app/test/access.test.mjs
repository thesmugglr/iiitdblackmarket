import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Local PostgreSQL behavior, not a substitute for live Supabase OAuth/storage QA.
test('database access regression scenarios', async (t) => {
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
  const initial = await readFile(new URL('../../supabase/migrations/0001_init.sql',import.meta.url),'utf8');
  // pgcrypto is not bundled in PGlite; UUID generation is built into PostgreSQL.
  await db.exec(initial.replace('create extension if not exists pgcrypto;',''));
  await db.exec(`grant usage on schema public,auth,storage to authenticated,anon;
    grant all on all tables in schema public,storage to authenticated,anon;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/0002_review_access.sql',import.meta.url),'utf8'));
  const admin='00000000-0000-0000-0000-000000000001';
  const seller='00000000-0000-0000-0000-000000000002';
  const buyer='00000000-0000-0000-0000-000000000003';
  const other='00000000-0000-0000-0000-000000000004';
  const as = async (id,role='authenticated') => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);
  };
  const owner = () => as(null,'none');
  const scalar = async (sql,params=[]) => Object.values((await db.query(sql,params)).rows[0])[0];
  for (const [id,name] of [[admin,'admin'],[seller,'seller'],[buyer,'buyer'],[other,'other']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@iiitd.ac.in`]);
  }
  await t.test('SQL editor can bootstrap first admin; student cannot self-promote',async()=>{
    await db.query("update profiles set role='admin',status='approved' where id=$1",[admin]);
    await db.query("update profiles set status='approved' where id<>$1",[admin]);
    await as(buyer);
    await assert.rejects(db.query("update profiles set role='admin' where id=$1",[buyer]),/Not allowed/);
    await db.query("update profiles set display_name='Buyer updated' where id=$1",[buyer]);
  });
  await as(seller);
  await t.test('member can read public names and own email, but not other emails or admin directory',async()=>{
    await assert.rejects(db.query('select email from profiles where id=$1',[buyer]),/permission denied/);
    assert.equal(await scalar('select display_name from profiles where id=$1',[buyer]),'Buyer updated');
    assert.equal(await scalar('select email from my_profile()'),'seller@iiitd.ac.in');
    assert.equal((await db.query('select * from admin_profiles()')).rows.length,0);
  });
  const listing=await scalar(`insert into listings(seller_id,title,listing_type,category,condition,price_inr)
    values($1,'A test item','sale','electronics','good',500) returning id`,[seller]);
  await as(buyer);
  const conv=await scalar('select start_conversation($1)',[listing]);
  await t.test('unrelated approved student cannot read private conversations',async()=>{
    await as(other);
    assert.equal(await scalar('select count(*)::int from conversations where id=$1',[conv]),0);
    assert.equal(await scalar('select count(*)::int from messages where conversation_id=$1',[conv]),0);
  });
  await t.test('recipient block stops text, offer RPC, attachment, and new chat',async()=>{
    await as(seller);
    await db.query('insert into blocks values($1,$2)',[seller,buyer]);
    await as(buyer);
    await assert.rejects(db.query('insert into messages(conversation_id,sender_id,body) values($1,$2,$3)',[conv,buyer,'blocked']),/row-level security/);
    await assert.rejects(db.query('select make_offer($1,100)',[conv]),/Conversation unavailable/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('chat-attachments',$1)",[`${conv}/blocked.png`]),/row-level security/);
    await assert.rejects(db.query('select start_conversation($1)',[listing]),/Unable to contact/);
    await as(seller); await db.query('delete from blocks where blocker_id=$1',[seller]);
  });
  await t.test('suspension blocks existing conversation reads and offer writes',async()=>{
    await owner(); await db.query("update profiles set status='suspended' where id=$1",[buyer]);
    await as(buyer);
    assert.equal(await scalar('select count(*)::int from conversations where id=$1',[conv]),0);
    await assert.rejects(db.query('select make_offer($1,100)',[conv]),/Conversation unavailable/);
    assert.equal((await db.query('select * from unread_counts()')).rows.length,0);
    await owner(); await db.query("update profiles set status='approved' where id=$1",[buyer]);
  });
  let first,second;
  await t.test('normal buyer offer works and seller acceptance reserves once',async()=>{
    await as(buyer);
    first=await scalar('select make_offer($1,300)',[conv]);
    second=await scalar('select make_offer($1,350)',[conv]);
    await as(seller); await db.query('select respond_offer($1,true)',[first]);
    assert.equal(await scalar('select status from listings where id=$1',[listing]),'reserved');
    assert.equal(await scalar('select status from offers where id=$1',[second]),'declined');
    await assert.rejects(db.query('select respond_offer($1,true)',[second]),/Offer not pending/);
  });
  await t.test('seller cannot restore administrator-removed listing',async()=>{
    await owner(); await db.query("update listings set status='removed' where id=$1",[listing]);
    await as(seller);
    const result=await db.query("update listings set status='active' where id=$1 returning id",[listing]);
    assert.equal(result.rows.length,0);
    await owner(); assert.equal(await scalar('select status from listings where id=$1',[listing]),'removed');
  });
});
