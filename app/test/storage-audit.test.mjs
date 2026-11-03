import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const sql = await readFile(new URL('../../supabase/ops/storage-audit.sql', import.meta.url), 'utf8')

test('read-only storage operations report', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`
    create schema storage;
    create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,metadata jsonb,created_at timestamptz,updated_at timestamptz,unique(bucket_id,name));
    create table listings(id integer primary key,photos text[],status text,expires_at timestamptz);
    create table messages(id integer primary key,image_path text,body text);
    insert into storage.buckets values ('listing-photos',false,5242880,array['image/jpeg']),('chat-attachments',false,5242880,array['image/png']),('unrelated',true,null,null);
    insert into listings values
      (1,array['owner/active.jpg'],'active',now()+interval '1 day'),
      (2,array['owner/expired.jpg'],'active',now()-interval '1 day'),
      (3,array['owner/removed.jpg'],'removed',now()+interval '1 day'),
      (4,array['owner/active.jpg'],'sold',now()+interval '1 day'),
      (5,array['owner/legacy.png'],'active',now()+interval '1 day'),
      (6,array['owner/missing.jpg',null,''],'active',now()+interval '1 day');
    insert into messages values (1,'conv/photo.png','Private fixture body must not appear'),(2,null,'Text-only message');
  `)
  const object = async (bucket, name, size, age = '2 days', modified = null) => {
    await db.query(`insert into storage.objects values($1,$2,$3::jsonb,now()-$4::interval,case when $5::text is null then null else now()-$5::interval end)`, [bucket, name, JSON.stringify(size === undefined ? {} : { size }), age, modified])
  }
  for (const name of ['owner/active.jpg', 'owner/active_t.jpg', 'owner/expired.jpg', 'owner/expired_t.jpg', 'owner/removed.jpg', 'owner/removed_t.jpg', 'owner/legacy.png']) await object('listing-photos', name, 10)
  await object('chat-attachments', 'conv/photo.png', 20)
  await object('listing-photos', 'owner/old-unlinked.jpg', 30)
  await object('listing-photos', 'owner/recent-unlinked.jpg', 40, '1 hour')
  await object('listing-photos', 'owner/recently-modified.jpg', 50, '2 days', '1 hour')
  await db.exec("insert into storage.objects values('listing-photos','owner/unknown-age.jpg','{\"size\":60}',null,null)")
  await object('unrelated', 'do-not-report.jpg', 999999)
  const audit = async () => (await db.exec(sql)).find(result => result.rows[0]?.storage_audit)?.rows[0].storage_audit
  const bucket = (report, id = 'listing-photos') => report.buckets.find(b => b.bucket_id === id)

  await t.test('the actual report runs in a read-only repeatable-read transaction', async () => {
    const result = await audit()
    assert.equal(result.audit_version, 1); assert.equal(result.transaction_read_only, 'on'); assert.equal(result.transaction_isolation, 'repeatable read')
    assert.equal(result.minimum_age_seconds, 86400); assert.ok(Number(result.database_bytes) > 0)
    assert.equal(result.buckets.length, 2); assert.equal(JSON.stringify(result).includes('Private fixture body'), false)
    assert.equal(JSON.stringify(result).includes('do-not-report'), false)
  })
  await t.test('all listing statuses, originals, thumbnails and chat attachments remain referenced', async () => {
    const result = await audit()
    assert.equal(bucket(result).referenced_objects, 7); assert.equal(bucket(result, 'chat-attachments').referenced_objects, 1)
    assert.deepEqual(result.review_candidate_sample.map(o => o.name), ['owner/old-unlinked.jpg'])
    assert.equal(bucket(result).known_object_bytes, '250'); assert.equal(bucket(result).objects, 11)
  })
  await t.test('recent, recently modified and unknown-age files are held instead of becoming candidates', async () => {
    const result = await audit()
    assert.equal(bucket(result).held_unreferenced_objects, 3); assert.equal(bucket(result).review_candidate_objects, 1)
    assert.equal(bucket(result).review_candidate_known_bytes, '30')
  })
  await t.test('missing required originals and optional legacy thumbnails are distinct', async () => {
    const result = await audit(), missing = result.missing_reference_sample
    assert.equal(bucket(result).missing_required_metadata, 1); assert.equal(bucket(result).missing_optional_thumbnail_metadata, 2)
    assert.ok(missing.some(r => r.name === 'owner/missing.jpg' && r.required))
    assert.ok(missing.some(r => r.name === 'owner/legacy_t.jpg' && !r.required))
    assert.equal(result.invalid_reference_entries, 2)
  })
  await t.test('duplicate references never double-count object sizes', async () => {
    const before = bucket(await audit()).known_object_bytes
    await db.exec("insert into listings values(7,array['owner/active.jpg','owner/active.jpg'],'reserved',now()+interval '1 day')")
    assert.equal(bucket(await audit()).known_object_bytes, before)
  })
  await t.test('unknown/corrupt sizes are counted as unknown, while large integer bytes stay exact', async () => {
    for (const [i, size] of [undefined, -1, 'bad', '1.5', '1'.repeat(40)].entries()) await object('chat-attachments', `conv/unknown-${i}.png`, size)
    await object('chat-attachments', 'conv/large.png', '9007199254740993')
    const report = bucket(await audit(), 'chat-attachments')
    assert.equal(report.unknown_size_objects, 5); assert.equal(report.known_object_bytes, '9007199254741013')
  })
  await t.test('candidate samples are bounded and explicitly marked truncated', async () => {
    await db.exec("insert into storage.objects select 'listing-photos','owner/sample-'||lpad(i::text,3,'0')||'.jpg','{\"size\":1}',now()-interval '3 days',null from generate_series(1,110) i")
    const result = await audit()
    assert.equal(result.review_candidate_sample.length, 100); assert.equal(result.review_candidate_sample_truncated, true)
    assert.equal(bucket(result).review_candidate_objects, 111)
  })
  await t.test('missing-reference samples are bounded without hiding full totals', async () => {
    await db.exec("insert into listings select 100+i,array['owner/missing-'||i||'.jpg'],'active',now()+interval '1 day' from generate_series(1,110) i")
    const result = await audit()
    assert.equal(result.missing_reference_sample.length, 100); assert.equal(result.missing_reference_sample_truncated, true)
    assert.equal(bucket(result).missing_required_metadata, 111)
  })
  await t.test('configured nonnegative age changes review triage without changing objects', async () => {
    const before = (await db.query('select * from storage.objects order by bucket_id,name')).rows
    await db.exec("set iiitd.audit_min_age='0 seconds'")
    const result = await audit()
    assert.equal(result.minimum_age_seconds, 0); assert.equal(bucket(result).held_unreferenced_objects, 1)
    assert.deepEqual((await db.query('select * from storage.objects order by bucket_id,name')).rows, before)
    await db.exec("set iiitd.audit_min_age=''")
  })
  await t.test('negative age refuses the report rather than producing misleading candidates', async () => {
    await db.exec("set iiitd.audit_min_age='-1 day'")
    await assert.rejects(audit(), /nonnegative/)
    await db.exec("rollback; set iiitd.audit_min_age=''")
  })
  await t.test('an ordinary SQL role cannot receive an incomplete RLS-filtered audit', async () => {
    await db.exec('create role audit_client; set role audit_client')
    await assert.rejects(audit(), /trusted SQL administrator/)
    await db.exec('rollback; reset role')
  })
  await t.test('missing buckets remain visible and no report query mutates catalog configuration', async () => {
    await db.exec("delete from storage.buckets where id='chat-attachments'")
    const result = await audit()
    assert.equal(bucket(result, 'chat-attachments').bucket_exists, false)
    assert.equal((await db.query("select public from storage.buckets where id='listing-photos'")).rows[0].public, false)
    assert.equal((await db.query("select count(*)::int n from storage.buckets where id='chat-attachments'")).rows[0].n, 0)
  })
})
