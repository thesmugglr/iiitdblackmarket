// End-to-end checks against the LOCAL Supabase stack (`npx supabase start` from the repo root).
// Usage: node scripts/e2e-local.mjs   (reads keys from `supabase status`)
import { createClient } from '@supabase/supabase-js'
import { readLocalStack } from './local-stack.mjs'
import assert from 'node:assert/strict'

const env = readLocalStack()
const URL_ = env.API_URL, ANON = env.ANON_KEY
const admin = createClient(URL_, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const run = Date.now().toString(36)
const results = []
const createdUsers = [], clients = [], uploadedObjects = [], bootstrapEmails = []
const step = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name) }
  catch (e) { results.push(['FAIL', name]); console.log('FAIL', name, '\n    ', e.message) }
}
const ok = (r, msg) => { if (r.error) throw new Error(`${msg ?? 'query'}: ${r.error.message}`); return r.data }

async function user(name, { approve = true, role = 'student' } = {}) {
  const email = `${name}.${run}@iiitd.ac.in`, password = 'localtest-pass'
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const id = created.data.user.id
  createdUsers.push(id)
  if (approve) ok(await admin.from('profiles').update({ status: 'approved', role }).eq('id', id))
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  clients.push(c)
  ok(await c.auth.signInWithPassword({ email, password }))
  return { id, email, c }
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let seller, buyer, outsider, pending, adm, listing, conv, photoPath

await step('only @iiitd.ac.in accounts can sign up', async () => {
  const r = await admin.auth.admin.createUser({ email: `x.${run}@gmail.com`, password: 'localtest-pass', email_confirm: true })
  if (r.data?.user) createdUsers.push(r.data.user.id)
  assert.ok(r.error, 'gmail signup should be rejected')
})
await step('create users; unapproved student sees nothing', async () => {
  seller = await user('seller'); buyer = await user('buyer'); outsider = await user('outsider')
  adm = await user('admin', { role: 'admin' }); pending = await user('pending', { approve: false })
  const r = await pending.c.from('listings').select('id')
  assert.equal(r.data?.length ?? 0, 0)
})
await step('bootstrap admin email becomes admin on first sign-in; a pending sign-up alerts admins', async () => {
  const email = `boot.${run}@iiitd.ac.in`
  ok(await admin.from('admin_bootstrap').insert({ email }))
  bootstrapEmails.push(email)
  // GoTrue inserts the user and confirms the email in a follow-up update, the same order as a Google sign-up.
  const created = await admin.auth.admin.createUser({ email, password: 'localtest-pass', email_confirm: true })
  if (created.error) throw created.error
  createdUsers.push(created.data.user.id)
  const p = ok(await admin.from('profiles').select('role,status').eq('id', created.data.user.id).single())
  assert.deepEqual(p, { role: 'admin', status: 'approved' })
  assert.ok(ok(await adm.c.from('notifications').select('*').eq('kind', 'approval')).length >= 1)
  assert.ok((await outsider.c.from('admin_bootstrap').select('*')).error, 'students must not read the bootstrap list')
})
await step('a listed student code approves a sign-up; an unlisted code waits; students cannot read the codes', async () => {
  const code = '9' + String(Date.now() % 10000).padStart(4, '0') // five digits, in a range real batches never use
  ok(await admin.from('student_codes').insert({ code }))
  const mk = async (email) => { const r = await admin.auth.admin.createUser({ email, password: 'localtest-pass', email_confirm: true }); if (r.error) throw r.error; return r.data.user.id }
  const listed = await mk(`listed${code}@iiitd.ac.in`)
  const unlisted = await mk(`unlisted${Number(code) - 1}@iiitd.ac.in`)
  const status = async (id) => ok(await admin.from('profiles').select('status').eq('id', id).single()).status
  assert.equal(await status(listed), 'approved')
  assert.equal(await status(unlisted), 'pending')
  assert.ok((await outsider.c.from('student_codes').select('*')).error, 'students must not read the code list')
})
await step('seller creates a listing with a photo (private bucket)', async () => {
  photoPath = `${seller.id}/test-${run}.png`
  ok(await seller.c.storage.from('listing-photos').upload(photoPath, png, { contentType: 'image/png' }), 'upload')
  uploadedObjects.push(['listing-photos', photoPath])
  listing = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'E2E kettle', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 400, photos: [photoPath] }).select().single())
})
await step('approved member can read listing and signed photo URL; pending cannot', async () => {
  const l = ok(await buyer.c.from('listings').select('*').eq('id', listing.id))
  assert.equal(l.length, 1)
  const s = await buyer.c.storage.from('listing-photos').createSignedUrl(photoPath, 60)
  assert.ok(s.data?.signedUrl)
  const p = await pending.c.storage.from('listing-photos').createSignedUrl(photoPath, 60)
  assert.ok(p.error || !p.data?.signedUrl)
  assert.equal((await pending.c.from('listings').select('id')).data.length, 0)
})
await step('member cannot edit or delete another seller\'s listing', async () => {
  await buyer.c.from('listings').update({ title: 'hacked' }).eq('id', listing.id)
  await buyer.c.from('listings').delete().eq('id', listing.id)
  const l = ok(await seller.c.from('listings').select('title').eq('id', listing.id).single())
  assert.equal(l.title, 'E2E kettle')
})
await step('profiles hide other users\' emails', async () => {
  const r = await buyer.c.from('profiles').select('email').eq('id', seller.id)
  assert.ok(r.error, 'email column must not be readable')
  const n = ok(await buyer.c.from('profiles').select('display_name').eq('id', seller.id))
  assert.equal(n.length, 1)
})
await step('buyer starts conversation, exchanges messages with attachment', async () => {
  conv = ok(await buyer.c.rpc('start_conversation', { p_listing: listing.id }))
  ok(await buyer.c.from('messages').insert({ conversation_id: conv, sender_id: buyer.id, body: 'Is it available?' }))
  const att = `${conv}/pic-${run}.png`
  ok(await buyer.c.storage.from('chat-attachments').upload(att, png, { contentType: 'image/png' }), 'attachment upload')
  uploadedObjects.push(['chat-attachments', att])
  ok(await buyer.c.from('messages').insert({ conversation_id: conv, sender_id: buyer.id, image_path: att }))
  const m = ok(await seller.c.from('messages').select('*').eq('conversation_id', conv))
  assert.equal(m.length, 2)
  const s = await seller.c.storage.from('chat-attachments').createSignedUrl(att, 60)
  assert.ok(s.data?.signedUrl)
})
await step('outsider cannot read the conversation, messages or attachment', async () => {
  assert.equal((await outsider.c.from('conversations').select('id')).data.length, 0)
  assert.equal((await outsider.c.from('messages').select('id')).data.length, 0)
  const s = await outsider.c.storage.from('chat-attachments').createSignedUrl(`${conv}/pic-${run}.png`, 60)
  assert.ok(s.error || !s.data?.signedUrl)
  const w = await outsider.c.from('messages').insert({ conversation_id: conv, sender_id: outsider.id, body: 'spam' })
  assert.ok(w.error)
})
await step('unread counts and read receipts', async () => {
  const u = ok(await seller.c.rpc('unread_counts'))
  assert.equal(Number(u.find((r) => r.conversation_id === conv).unread), 2)
  ok(await seller.c.rpc('mark_read', { p_conversation: conv }))
  assert.equal(ok(await seller.c.rpc('unread_counts')).length, 0)
})
await step('new-message notification reaches the seller only', async () => {
  const n = ok(await seller.c.from('notifications').select('*').eq('kind', 'message'))
  assert.ok(n.length >= 1)
  assert.equal((await buyer.c.from('notifications').select('id').eq('kind', 'message')).data.length, 0)
})
await step('buyer offers, seller accepts, listing reserved', async () => {
  ok(await buyer.c.rpc('make_offer', { p_conversation: conv, p_amount: 350 }))
  const o = ok(await seller.c.from('offers').select('*').eq('status', 'pending'))
  const bad = await buyer.c.rpc('respond_offer', { p_offer: o[0].id, p_accept: true })
  assert.ok(bad.error, 'buyer must not accept own offer')
  ok(await seller.c.rpc('respond_offer', { p_offer: o[0].id, p_accept: true }))
  const l = ok(await seller.c.from('listings').select('status,price_inr').eq('id', listing.id).single())
  assert.deepEqual([l.status, l.price_inr], ['reserved', 350])
})
await step('block prevents new messages', async () => {
  ok(await seller.c.from('blocks').insert({ blocker_id: seller.id, blocked_id: buyer.id }))
  const r = await buyer.c.from('messages').insert({ conversation_id: conv, sender_id: buyer.id, body: 'hello?' })
  assert.ok(r.error)
  ok(await seller.c.from('blocks').delete().eq('blocker_id', seller.id))
})
await step('report goes to admin; admin can approve a pending user', async () => {
  ok(await buyer.c.from('reports').insert({ reporter_id: buyer.id, listing_id: listing.id, reason: 'testing' }))
  assert.equal(ok(await adm.c.from('reports').select('id').eq('status', 'open')).length >= 1, true)
  assert.equal((await outsider.c.from('reports').select('id')).data.length, 0)
  ok(await adm.c.rpc('admin_set_status', { p_user: pending.id, p_status: 'approved' }))
  assert.equal((await adm.c.rpc('admin_profiles')).data.some((p) => p.email === pending.email), true)
  assert.ok((await buyer.c.rpc('admin_profiles')).data?.length === 0)
})
await step('student cannot promote self to admin', async () => {
  await outsider.c.from('profiles').update({ role: 'admin' }).eq('id', outsider.id)
  const p = ok(await outsider.c.rpc('my_profile'))
  assert.equal(p[0].role, 'student')
})
await step('wanted post, reply, notification', async () => {
  const post = ok(await buyer.c.from('wanted_posts').insert({ user_id: buyer.id, title: 'Need a lamp', category: 'hostel' }).select().single())
  const l2 = ok(await outsider.c.from('listings').insert({ seller_id: outsider.id, title: 'Spare lamp', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 100 }).select().single())
  ok(await outsider.c.rpc('respond_wanted', { p_post: post.id, p_listing: l2.id }))
  assert.ok(ok(await buyer.c.from('notifications').select('*').eq('kind', 'wanted')).length >= 1)
})
await step('bundle creation and sale', async () => {
  const mk = async (t) => ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: t, listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 100 }).select().single())
  const a = await mk('Bundle A'), b = await mk('Bundle B')
  const id = ok(await seller.c.rpc('create_bundle', { p_title: 'Kit', p_description: '', p_price: 150, p_listings: [a.id, b.id] }))
  assert.equal(ok(await buyer.c.from('bundle_items').select('*').eq('bundle_id', id)).length, 2)
  ok(await seller.c.rpc('mark_bundle_sold', { p_bundle: id }))
  assert.equal(ok(await seller.c.from('listings').select('status').eq('id', a.id).single()).status, 'sold')
})
await step('expiry reminder and renewal', async () => {
  const l = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Expiring', listing_type: 'sale', category: 'misc', condition: 'good', price_inr: 10 }).select().single())
  ok(await admin.from('listings').update({ expires_at: new Date(Date.now() + 86400000).toISOString() }).eq('id', l.id))
  ok(await seller.c.rpc('refresh_expiry_notices'))
  assert.ok(ok(await seller.c.from('notifications').select('*').eq('kind', 'expiry')).length >= 1)
  ok(await seller.c.rpc('renew_listing', { p_listing: l.id }))
  ok(await admin.from('listings').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', l.id))
  assert.equal((await buyer.c.from('listings').select('id').eq('id', l.id)).data.length, 0)
})
await step('Storage service rejects disallowed types and oversized images in both buckets', async () => {
  for (const [bucket, prefix, client] of [['listing-photos', seller.id, seller.c], ['chat-attachments', conv, buyer.c]]) {
    for (const [content, contentType, suffix] of [[Buffer.from('fixture text'), 'text/plain', 'txt'], [Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 'png']]) {
      const path = `${prefix}/rejection-${run}.${suffix}`
      const result = await client.storage.from(bucket).upload(path, content, { contentType })
      if (!result.error) uploadedObjects.push([bucket, path])
      assert.ok(result.error, `${bucket} must reject ${suffix} fixture`)
      assert.ok([400,413,415].includes(Number(result.error.statusCode)), 'rejection must be a validation response, not a connection/auth failure')
      const objects = ok(await admin.storage.from(bucket).list(prefix,{search:`rejection-${run}.${suffix}`}))
      assert.equal(objects.some(object=>object.name===`rejection-${run}.${suffix}`), false, 'rejected uploads must not leave an object')
    }
  }
})
await step('simultaneous seller sessions accept exactly one competing offer', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id:seller.id, title:'Concurrent offer fixture', listing_type:'sale', category:'misc', condition:'good', price_inr:500 }).select().single())
  const offerIds = []
  for (const [member, amount] of [[buyer, 300], [outsider, 400]]) {
    const conversation = ok(await member.c.rpc('start_conversation', {p_listing:item.id}))
    ok(await member.c.rpc('make_offer', {p_conversation:conversation, p_amount:amount}))
    const offer = ok(await seller.c.from('offers').select('id').eq('conversation_id',conversation).eq('status','pending').single())
    offerIds.push(offer.id)
  }
  const secondSeller = createClient(URL_, ANON, {auth:{persistSession:false}})
  clients.push(secondSeller)
  ok(await secondSeller.auth.signInWithPassword({email:seller.email,password:'localtest-pass'}))
  const responses = await Promise.all([
    seller.c.rpc('respond_offer',{p_offer:offerIds[0],p_accept:true}),
    secondSeller.rpc('respond_offer',{p_offer:offerIds[1],p_accept:true}),
  ])
  assert.equal(responses.filter(r=>!r.error).length,1,'only one acceptance may succeed')
  const offers = ok(await seller.c.from('offers').select('status,amount_inr').eq('listing_id',item.id))
  const accepted = offers.filter(o=>o.status==='accepted')
  assert.equal(accepted.length,1)
  assert.equal(offers.filter(o=>o.status==='declined').length,1)
  const reserved = ok(await seller.c.from('listings').select('status,price_inr').eq('id',item.id).single())
  assert.equal(reserved.status,'reserved')
  assert.equal(reserved.price_inr,accepted[0].amount_inr)
})
// The realtime service needs a moment to warm up after a (re)start, so the first attempt may time out.
const realtimeOnce = async (ms) => {
  let timer
  const channel = seller.c.channel(`t-${Math.random().toString(36).slice(2)}`)
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no realtime event in ${ms / 1000}s`)), ms)
      channel.on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`conversation_id=eq.${conv}` }, resolve)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') buyer.c.from('messages').insert({conversation_id:conv,sender_id:buyer.id,body:'realtime ping'}).then(r=>{if(r.error)reject(new Error('insert failed: '+r.error.message))})
          if (['CHANNEL_ERROR','TIMED_OUT'].includes(status)) reject(new Error('realtime subscription failed'))
        })
    })
  } finally { clearTimeout(timer); await seller.c.removeChannel(channel) }
}
await step('realtime delivers a new message to the seller', async () => {
  try { await realtimeOnce(8000) } catch (e) { if (/insert failed/.test(e.message)) throw e; await realtimeOnce(12000) }
})

await step('remove only photos, bootstrap rows and accounts created by this run', async () => {
  const errors = []
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh() }
  for (const [bucket,path] of uploadedObjects) {
    const result = await admin.storage.from(bucket).remove([path])
    if (result.error) errors.push('fixture object cleanup failed')
  }
  for (const id of createdUsers.reverse()) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) errors.push('fixture account cleanup failed')
  }
  for (const email of bootstrapEmails) {
    const result = await admin.from('admin_bootstrap').delete().eq('email',email)
    if (result.error) errors.push('fixture bootstrap cleanup failed')
  }
  assert.deepEqual(errors,[])
})
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exitCode = failed ? 1 : 0
