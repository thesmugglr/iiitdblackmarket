// End-to-end checks against the LOCAL Supabase stack (`npx supabase start` from the repo root).
// Usage: node scripts/e2e-local.mjs   (reads keys from `supabase status`)
import { createClient } from '@supabase/supabase-js'
import { readLocalStack } from './local-stack.mjs'
import { thumbPath } from '../src/lib/image.ts'
import { addStudentRoster, changeMemberStatus, removeReportedListing, updateReportStatus } from '../src/lib/adminActions.ts'
import { loadProfileDashboard, saveProfile } from '../src/lib/profileData.ts'
import { cleanupListingPhotos, deleteOwnedListing, updateOwnedListingStatus } from '../src/lib/listingActions.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { observeTextComposer, sendChatText } from '../src/lib/chatText.ts'
import { makeOfferOnce, observeOfferComposer, respondOfferOnce } from '../src/lib/chatOffers.ts'
import { observeAttachment, sendChatImage, uploadChatAttachment } from '../src/lib/chatAttachments.ts'

const env = readLocalStack()
const URL_ = env.API_URL, ANON = env.ANON_KEY
const admin = createClient(URL_, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const run = Date.now().toString(36)
const results = []
const createdUsers = [], clients = [], uploadedObjects = [], bootstrapEmails = [], studentCodes = [], rosterEmails = []
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
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')
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
  studentCodes.push(code)
  const mk = async (email) => {
    const r = await admin.auth.admin.createUser({ email, password: 'localtest-pass', email_confirm: true })
    if (r.error) throw r.error
    createdUsers.push(r.data.user.id)
    return r.data.user.id
  }
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
await step('listing photo thumbnails: stored next to the photo, a missing one does not break signing, only the owner can delete', async () => {
  const files = (c) => c.storage.from('listing-photos')
  const thumb = thumbPath(photoPath)
  const absent = thumbPath(`${seller.id}/never-uploaded-${run}.jpg`)
  // The small copy lives in the seller's own folder, so the existing upload rule covers it. File names are random
  // and never reused, so browsers may keep the picture for a year.
  ok(await files(seller.c).upload(thumb, jpeg, { contentType: 'image/jpeg', cacheControl: '31536000' }), 'thumbnail upload')
  uploadedObjects.push(['listing-photos', thumb])
  // The app signs the small copy and the full photo in one call: an object that does not exist must come back
  // without a link instead of failing the whole batch.
  const signed = ok(await files(buyer.c).createSignedUrls([thumb, absent, photoPath], 60))
  const link = new Map(signed.map((s) => [s.path, s.signedUrl]))
  assert.ok(link.get(thumb) && link.get(photoPath), 'existing objects get links')
  assert.ok(!link.get(absent), 'a missing thumbnail gets no link')
  // Signed links carry an ETag, so a browser that reuses the same link revalidates cheaply (304) instead of downloading again.
  const res = await fetch(link.get(thumb))
  assert.equal(res.status, 200)
  const again = await fetch(link.get(thumb), { headers: { 'if-none-match': res.headers.get('etag') ?? '' } })
  assert.equal(again.status, 304)
  // Another member cannot delete it ...
  await files(buyer.c).remove([thumb])
  assert.ok(ok(await files(buyer.c).createSignedUrls([thumb], 60))[0].signedUrl, 'still there after a stranger tried to delete it')
  // ... but the seller can remove the pair, which is what the app does when a listing is deleted.
  const pair = [`${seller.id}/pair-${run}.jpg`, `${seller.id}/pair-${run}_t.jpg`]
  for (const p of pair) ok(await files(seller.c).upload(p, jpeg, { contentType: 'image/jpeg' }), 'pair upload')
  uploadedObjects.push(...pair.map((p) => ['listing-photos', p]))
  ok(await files(seller.c).remove(pair))
  assert.equal(ok(await files(buyer.c).createSignedUrls(pair, 60)).filter((s) => s.signedUrl).length, 0, 'both files are gone')
})
await step('member cannot edit or delete another seller\'s listing', async () => {
  await buyer.c.from('listings').update({ title: 'hacked' }).eq('id', listing.id)
  await buyer.c.from('listings').delete().eq('id', listing.id)
  const l = ok(await seller.c.from('listings').select('title').eq('id', listing.id).single())
  assert.equal(l.title, 'E2E kettle')
})
await step('saved-item upserts are idempotent and isolated; pending users cannot save', async () => {
  const entry = { user_id: buyer.id, listing_id: listing.id }
  for (let i = 0; i < 2; i++) {
    ok(await buyer.c.from('saved_items').upsert(entry, { onConflict: 'user_id,listing_id', ignoreDuplicates: true }))
  }
  assert.equal(ok(await buyer.c.from('saved_items').select('listing_id').eq('user_id', buyer.id)).length, 1)
  assert.equal(ok(await outsider.c.from('saved_items').select('listing_id').eq('user_id', buyer.id)).length, 0)
  assert.equal(ok(await outsider.c.from('saved_items').delete().eq('user_id', buyer.id).select('listing_id')).length, 0)
  assert.ok((await outsider.c.from('saved_items').upsert(entry, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })).error)
  assert.ok((await pending.c.from('saved_items').upsert({ user_id: pending.id, listing_id: listing.id }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })).error)
  assert.equal(ok(await buyer.c.from('saved_items').select('listing_id').eq('user_id', buyer.id)).length, 1)
  ok(await buyer.c.from('saved_items').delete().eq('user_id', buyer.id).eq('listing_id', listing.id))
  assert.equal(ok(await buyer.c.from('saved_items').select('listing_id').eq('user_id', buyer.id)).length, 0)
})
await step('profiles hide other users\' emails', async () => {
  const r = await buyer.c.from('profiles').select('email').eq('id', seller.id)
  assert.ok(r.error, 'email column must not be readable')
  const n = ok(await buyer.c.from('profiles').select('display_name').eq('id', seller.id))
  assert.equal(n.length, 1)
})
await step('profile helper confirms own editable fields, rejects another account and preserves protected fields', async () => {
  const changed = await saveProfile(buyer.c, buyer.id, ' Local buyer ', ' 2027 ')
  assert.deepEqual(changed, { id: buyer.id, display_name: 'Local buyer', batch: '2027' })
  await assert.rejects(saveProfile(outsider.c, buyer.id, 'Not the owner', '2028'))
  const own = ok(await buyer.c.rpc('my_profile').single())
  assert.equal(own.display_name, 'Local buyer')
  assert.equal(own.batch, '2027')
  assert.equal(own.email, buyer.email)
  assert.equal(own.role, 'student')
  assert.equal(own.status, 'approved')
  assert.ok((await buyer.c.from('profiles').select('email').eq('id', buyer.id)).error)
  assert.equal((await saveProfile(buyer.c, buyer.id, 'Local buyer', ' ')).batch, null)
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
await step('personal dashboard includes buyer/seller deals and excludes unrelated offers even for administrators', async () => {
  const initial = ok(await buyer.c.from('offers').select('id').eq('listing_id', listing.id).eq('status', 'accepted').single())
  for (const member of [buyer, seller]) {
    const dashboard = await loadProfileDashboard(member.c, member.id)
    assert.deepEqual(dashboard.deals.map(d => d.id), [initial.id])
  }
  assert.equal((await loadProfileDashboard(outsider.c, outsider.id)).deals.length, 0)
  assert.ok(ok(await adm.c.from('offers').select('id').eq('status', 'accepted')).some(o => o.id === initial.id), 'admin moderation access remains available')
  assert.equal((await loadProfileDashboard(adm.c, adm.id)).deals.length, 0, 'other members\' deals are not personal deals')
  const expected = []
  // Exercise each side of the embedded OR, including administrator-as-buyer.
  for (const [owner, purchaser] of [[adm, buyer], [seller, adm]]) {
    const item = ok(await owner.c.from('listings').insert({ seller_id: owner.id, title: 'Personal deal fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 50 }).select('id').single())
    const conversation = ok(await purchaser.c.rpc('start_conversation', { p_listing: item.id }))
    ok(await purchaser.c.rpc('make_offer', { p_conversation: conversation, p_amount: 50 }))
    const offer = ok(await owner.c.from('offers').select('id').eq('conversation_id', conversation).single())
    ok(await owner.c.rpc('respond_offer', { p_offer: offer.id, p_accept: true }))
    expected.push(offer.id)
  }
  const personal = await loadProfileDashboard(adm.c, adm.id)
  assert.deepEqual(personal.deals.map(d => d.id).sort(), expected.sort())
  assert.equal(personal.mine.length, 1)
  assert.equal(personal.mine[0].seller_id, adm.id)
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
  await changeMemberStatus(adm.c, pending.id, 'approved')
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

await step('admin helpers confirm roster approvals and moderation; rejected removal leaves report open', async () => {
  const member = await user('roster', { approve: false })
  rosterEmails.push(member.email)
  const before = ok(await adm.c.rpc('admin_profiles'))
  assert.deepEqual(await addStudentRoster(adm.c, `${member.email};${member.email}`, before), { added: 1, approved: 1, failed: 0 })
  const target = ok(await buyer.c.from('reports').insert({ reporter_id: buyer.id, listing_id: listing.id, reason: 'moderation helper fixture' }).select('id,listing_id').single())
  await assert.rejects(removeReportedListing(outsider.c, target))
  assert.equal(ok(await adm.c.from('reports').select('status').eq('id', target.id).single()).status, 'open')
  assert.equal(ok(await adm.c.from('listings').select('status').eq('id', listing.id).single()).status, 'reserved')
  await removeReportedListing(adm.c, target)
  assert.equal(ok(await adm.c.from('listings').select('status').eq('id', listing.id).single()).status, 'removed')
  assert.equal(ok(await adm.c.from('reports').select('status').eq('id', target.id).single()).status, 'resolved')
  await assert.rejects(updateReportStatus(outsider.c, target.id, 'dismissed'))
  await updateReportStatus(adm.c, target.id, 'dismissed')
  assert.equal(ok(await adm.c.from('reports').select('status').eq('id', target.id).single()).status, 'dismissed')
})

await step('owner listing helpers confirm status/deletion; denied writes preserve photos and actual deleted-row photos are cleaned', async () => {
  const member = await user('deletion')
  const original = `${member.id}/old-${run}.jpg`, current = `${member.id}/current-${run}.jpg`
  for (const path of [original, current, thumbPath(current)]) {
    ok(await member.c.storage.from('listing-photos').upload(path, jpeg, { contentType: 'image/jpeg' }))
    uploadedObjects.push(['listing-photos', path])
  }
  const item = ok(await member.c.from('listings').insert({ seller_id: member.id, title: 'Deletion fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 50, photos: [original] }).select('id').single())
  await updateOwnedListingStatus(member.c, item.id, member.id, 'reserved')
  assert.equal(ok(await member.c.from('listings').select('status').eq('id', item.id).single()).status, 'reserved')
  await assert.rejects(updateOwnedListingStatus(outsider.c, item.id, member.id, 'sold'))
  await assert.rejects(deleteOwnedListing(outsider.c, item.id, member.id))
  ok(await member.c.from('listings').update({ photos: [current] }).eq('id', item.id))
  await changeMemberStatus(adm.c, member.id, 'suspended')
  await assert.rejects(deleteOwnedListing(member.c, item.id, member.id))
  assert.equal(ok(await admin.from('listings').select('id').eq('id', item.id)).length, 1)
  assert.equal(ok(await admin.storage.from('listing-photos').createSignedUrls([original, current, thumbPath(current)], 60)).filter(s => s.signedUrl).length, 3)
  await changeMemberStatus(adm.c, member.id, 'approved')
  ok(await adm.c.from('listings').update({ status: 'removed' }).eq('id', item.id))
  await assert.rejects(updateOwnedListingStatus(member.c, item.id, member.id, 'active'))
  const photos = await deleteOwnedListing(member.c, item.id, member.id)
  assert.deepEqual(photos, [current], 'cleanup must use the actual deleted row, not an old detail snapshot')
  await changeMemberStatus(adm.c, member.id, 'suspended')
  await assert.rejects(cleanupListingPhotos(member.c, member.id, photos), /Retry photo cleanup/)
  assert.ok(ok(await admin.storage.from('listing-photos').createSignedUrls([current], 60))[0].signedUrl)
  await changeMemberStatus(adm.c, member.id, 'approved')
  await cleanupListingPhotos(member.c, member.id, photos)
  await cleanupListingPhotos(member.c, member.id, photos) // retry remains safe when originals/thumbnails are already absent
  assert.equal(ok(await admin.from('listings').select('id').eq('id', item.id)).length, 0)
  const signed = ok(await admin.storage.from('listing-photos').createSignedUrls([original, current, thumbPath(current)], 60))
  assert.ok(signed[0].signedUrl, 'old snapshot photo was not deleted by this cleanup')
  assert.ok(!signed[1].signedUrl && !signed[2].signedUrl, 'current original and thumbnail were removed')
})

await step('text composer confirms persisted sends, deduplicates a lost response retry and rejects unauthorized writers', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Text send fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 50 }).select('id').single())
  const conversation = ok(await buyer.c.rpc('start_conversation', { p_listing: item.id }))
  let loseResponse = true
  // Inject only a lost response after a REAL server insert commits. The retry
  // goes through the actual upsert/read policies on the same generated UUID.
  const flaky = { from(table) {
    const query = buyer.c.from(table)
    return {
      upsert: async (...args) => {
        const result = await query.upsert(...args)
        if (!result.error && loseResponse) { loseResponse = false; throw new Error('fixture lost response') }
        return result
      },
      select: (...args) => query.select(...args),
    }
  } }
  const states = [], attempts = []
  const composer = observeTextComposer({ newId: randomUUID, publish: s => states.push(s), write: async request => {
    attempts.push({ ...request })
    await sendChatText(flaky, conversation, buyer.id, request)
  } })
  composer.edit(' Confirmed fixture text ')
  await composer.send()
  assert.equal(states.at(-1).text, ' Confirmed fixture text ')
  assert.ok(states.at(-1).error)
  await composer.send()
  assert.equal(states.at(-1).text, '')
  assert.equal(states.at(-1).error, '')
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].id, attempts[1].id)
  const rows = ok(await seller.c.from('messages').select('id,body').eq('conversation_id', conversation))
  assert.deepEqual(rows, [{ id: attempts[0].id, body: 'Confirmed fixture text' }])
  await assert.rejects(sendChatText(buyer.c, conversation, buyer.id, { id: attempts[0].id, body: 'Changed payload' }))
  assert.equal(ok(await seller.c.from('messages').select('body').eq('id', attempts[0].id).single()).body, 'Confirmed fixture text')
  await assert.rejects(sendChatText(outsider.c, conversation, buyer.id, { id: randomUUID(), body: 'Forged sender' }))
  await assert.rejects(sendChatText(outsider.c, conversation, outsider.id, { id: randomUUID(), body: 'Not a participant' }))
  ok(await seller.c.from('blocks').insert({ blocker_id: seller.id, blocked_id: buyer.id }))
  await assert.rejects(sendChatText(buyer.c, conversation, buyer.id, { id: randomUUID(), body: 'Blocked' }))
  ok(await seller.c.from('blocks').delete().eq('blocker_id', seller.id).eq('blocked_id', buyer.id))
  await changeMemberStatus(adm.c, buyer.id, 'suspended')
  await assert.rejects(sendChatText(buyer.c, conversation, buyer.id, { id: randomUUID(), body: 'Suspended' }))
  await changeMemberStatus(adm.c, buyer.id, 'approved')
  composer.dispose()
  assert.equal(ok(await seller.c.from('messages').select('id').eq('conversation_id', conversation)).length, 1)
})

await step('new offer RPCs deduplicate concurrent/lost requests and repeated seller decisions without changing access rules', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Offer retry fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 500 }).select('id').single())
  const conversation = ok(await buyer.c.rpc('start_conversation', { p_listing: item.id }))
  const anotherSession = async member => {
    const client = createClient(URL_, ANON, { auth: { persistSession: false } })
    clients.push(client)
    ok(await client.auth.signInWithPassword({ email: member.email, password: 'localtest-pass' }))
    return client
  }
  const secondBuyer = await anotherSession(buyer), secondSeller = await anotherSession(seller)
  const first = { id: randomUUID(), amount: 300 }
  await Promise.all([makeOfferOnce(buyer.c, conversation, buyer.id, first), makeOfferOnce(secondBuyer, conversation, buyer.id, first)])
  const lost = { id: randomUUID(), amount: 400 }
  let loseResponse = true
  const flaky = { from: table => buyer.c.from(table), rpc: async (name, args) => {
    const result = await buyer.c.rpc(name, args)
    if (!result.error && loseResponse) { loseResponse = false; throw new Error('fixture lost offer response') }
    return result
  } }
  const states = []
  const composer = observeOfferComposer({ conversation, member: buyer.id, newId: () => lost.id,
    make: request => makeOfferOnce(flaky, conversation, buyer.id, request), respond: async () => {}, confirmed: () => {}, publish: s => states.push(s),
  })
  composer.edit('400'); await composer.make()
  assert.equal(states.at(-1).amount, '400'); assert.ok(states.at(-1).error)
  await composer.make()
  assert.equal(states.at(-1).amount, ''); assert.equal(states.at(-1).error, '')
  assert.equal(ok(await buyer.c.from('offers').select('id').eq('conversation_id', conversation)).length, 2)
  assert.equal(ok(await buyer.c.from('messages').select('id').eq('conversation_id', conversation)).length, 2)
  await assert.rejects(makeOfferOnce(buyer.c, conversation, buyer.id, { ...first, amount: 301 }))
  await assert.rejects(makeOfferOnce(outsider.c, conversation, outsider.id, { id: randomUUID(), amount: 200 }))
  const anonymous = createClient(URL_, ANON, { auth: { persistSession: false } })
  clients.push(anonymous)
  assert.ok((await anonymous.rpc('make_offer_once', { p_conversation: conversation, p_amount: 200, p_request: randomUUID() })).error)
  await Promise.all([respondOfferOnce(seller.c, conversation, first.id, true), respondOfferOnce(secondSeller, conversation, first.id, true)])
  await assert.rejects(respondOfferOnce(buyer.c, conversation, first.id, true))
  await assert.rejects(respondOfferOnce(seller.c, conversation, first.id, false))
  const listingState = ok(await seller.c.from('listings').select('status,price_inr').eq('id', item.id).single())
  assert.deepEqual(listingState, { status: 'reserved', price_inr: 300 })
  assert.equal(ok(await buyer.c.from('offers').select('status').eq('id', lost.id).single()).status, 'declined')
  assert.equal(ok(await buyer.c.from('messages').select('id').eq('conversation_id', conversation)).length, 3)
  composer.dispose()
})

await step('concurrent opposite offer decisions produce one outcome and one response message', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Offer decision race fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 500 }).select('id').single())
  const conversation = ok(await buyer.c.rpc('start_conversation', { p_listing: item.id }))
  const offer = { id: randomUUID(), amount: 350 }
  await makeOfferOnce(buyer.c, conversation, buyer.id, offer)
  const secondSeller = createClient(URL_, ANON, { auth: { persistSession: false } })
  clients.push(secondSeller)
  ok(await secondSeller.auth.signInWithPassword({ email: seller.email, password: 'localtest-pass' }))
  const results = await Promise.allSettled([respondOfferOnce(seller.c, conversation, offer.id, true), respondOfferOnce(secondSeller, conversation, offer.id, false)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const status = ok(await seller.c.from('offers').select('status').eq('id', offer.id).single()).status
  const record = ok(await seller.c.from('listings').select('status,price_inr').eq('id', item.id).single())
  assert.deepEqual(record, status === 'accepted' ? { status: 'reserved', price_inr: 350 } : { status: 'active', price_inr: 500 })
  assert.equal(ok(await buyer.c.from('messages').select('id').eq('conversation_id', conversation)).length, 2)
})

await step('attachment retry confirms real lost upload/message replies with one file and one message', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Attachment retry fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 50 }).select('id').single())
  const conversation = ok(await buyer.c.rpc('start_conversation', { p_listing: item.id }))
  const blob = new Blob([png], { type: 'image/png' }), attempts = [], states = []
  let uploads = 0, prepares = 0, confirmed = 0, loseUpload = true, loseMessage = true
  const flakyStorage = { storage: { from(bucket) {
    const real = buyer.c.storage.from(bucket)
    return { download: path => real.download(path), upload: async (...args) => {
      uploads++
      const result = await real.upload(...args)
      if (!result.error) {
        uploadedObjects.push([bucket, args[0]])
        if (loseUpload) { loseUpload = false; throw new Error('fixture lost upload response') }
      }
      return result
    } }
  } } }
  const flakyMessages = { from(table) {
    const real = buyer.c.from(table)
    return { select: (...args) => real.select(...args), upsert: async (...args) => {
      const result = await real.upsert(...args)
      if (!result.error && loseMessage) { loseMessage = false; throw new Error('fixture lost message response') }
      return result
    } }
  } }
  const composer = observeAttachment({ conversation, newId: randomUUID,
    prepare: async () => { prepares++; return { blob, ext: 'png', type: 'image/png' } },
    upload: request => uploadChatAttachment(flakyStorage, request),
    link: request => { attempts.push(request); return sendChatImage(flakyMessages, conversation, buyer.id, request) },
    confirmed: () => { confirmed++ }, publish: s => states.push(s),
  })
  await composer.choose(new File([png], 'attachment-fixture.png', { type: 'image/png' }))
  assert.ok(states.at(-1).error); assert.equal(states.at(-1).locked, true)
  await composer.retry()
  assert.equal(states.at(-1).pending, false); assert.equal(states.at(-1).error, '')
  assert.equal(prepares, 1); assert.equal(uploads, 1); assert.equal(confirmed, 1)
  assert.equal(attempts.length, 2); assert.equal(attempts[0].id, attempts[1].id)
  const request = attempts[0]
  assert.deepEqual(ok(await seller.c.from('messages').select('id,body,image_path').eq('conversation_id', conversation)), [{ id: request.id, body: '', image_path: request.path }])
  const objects = ok(await admin.storage.from('chat-attachments').list(conversation))
  assert.deepEqual(objects.map(o => o.name), [`${request.id}.png`])
  const signed = ok(await seller.c.storage.from('chat-attachments').createSignedUrl(request.path, 60))
  const response = await fetch(signed.signedUrl)
  assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
  await assert.rejects(sendChatImage(buyer.c, conversation, buyer.id, { id: request.id, path: `${conversation}/${request.id}.jpg` }))
  assert.equal(ok(await seller.c.from('messages').select('image_path').eq('id', request.id).single()).image_path, request.path)
  composer.dispose()
})

await step('attachment recovery rejects collisions and unauthorized links; restored membership retries the retained file', async () => {
  const item = ok(await seller.c.from('listings').insert({ seller_id: seller.id, title: 'Attachment access fixture', listing_type: 'sale', category: 'hostel', condition: 'good', price_inr: 50 }).select('id').single())
  const conversation = ok(await buyer.c.rpc('start_conversation', { p_listing: item.id }))
  const blob = new Blob([png], { type: 'image/png' }), id = randomUUID()
  const request = { conversation, id, path: `${conversation}/${id}.png`, blob, type: 'image/png' }
  await uploadChatAttachment(buyer.c, request)
  uploadedObjects.push(['chat-attachments', request.path])
  // Duplicate uploads must read back the SAME bytes; a different same-sized image must not replace them.
  await uploadChatAttachment(buyer.c, request)
  const different = Buffer.from(png); different[different.length - 1] ^= 1
  await assert.rejects(uploadChatAttachment(buyer.c, { ...request, blob: new Blob([different], { type: 'image/png' }) }))
  assert.deepEqual(Buffer.from(await ok(await buyer.c.storage.from('chat-attachments').download(request.path)).arrayBuffer()), png)
  await assert.rejects(uploadChatAttachment(outsider.c, request))
  await assert.rejects(sendChatImage(outsider.c, conversation, buyer.id, request))
  await assert.rejects(sendChatImage(outsider.c, conversation, outsider.id, request))
  ok(await seller.c.from('blocks').insert({ blocker_id: seller.id, blocked_id: buyer.id }))
  await assert.rejects(sendChatImage(buyer.c, conversation, buyer.id, request))
  ok(await seller.c.from('blocks').delete().eq('blocker_id', seller.id).eq('blocked_id', buyer.id))
  const states = []
  let uploadCount = 0
  const composer = observeAttachment({ conversation, newId: () => id,
    prepare: async () => ({ blob, ext: 'png', type: 'image/png' }),
    upload: async r => { uploadCount++; await uploadChatAttachment(buyer.c, r); await changeMemberStatus(adm.c, buyer.id, 'suspended') },
    link: r => sendChatImage(buyer.c, conversation, buyer.id, r), confirmed: () => {}, publish: s => states.push(s),
  })
  try {
    await composer.choose(new File([png], 'retained-fixture.png', { type: 'image/png' }))
    assert.ok(states.at(-1).error); assert.equal(states.at(-1).pending, true)
    assert.equal(ok(await seller.c.from('messages').select('id').eq('conversation_id', conversation)).length, 0)
    await assert.rejects(uploadChatAttachment(buyer.c, request))
  } finally { await changeMemberStatus(adm.c, buyer.id, 'approved') }
  await composer.retry()
  assert.equal(states.at(-1).pending, false); assert.equal(uploadCount, 1)
  assert.deepEqual(ok(await seller.c.from('messages').select('id,image_path').eq('conversation_id', conversation)), [{ id, image_path: request.path }])
  assert.equal(ok(await admin.storage.from('chat-attachments').list(conversation)).length, 1)
  composer.dispose()
})

await step('remove only photos, bootstrap rows, roster entries, student codes and accounts created by this run', async () => {
  const errors = []
  for (const email of rosterEmails) {
    const removed = await admin.from('student_roster').delete().eq('email', email)
    const remaining = await admin.from('student_roster').select('email').eq('email', email)
    if (removed.error || remaining.error || remaining.data?.length !== 0) errors.push('fixture roster cleanup failed')
  }
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh() }
  for (const [bucket,path] of uploadedObjects) {
    const result = await admin.storage.from(bucket).remove([path])
    if (result.error) errors.push('fixture object cleanup failed')
  }
  for (const id of createdUsers.reverse()) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) errors.push('fixture account cleanup failed')
    else {
      const missing = await admin.auth.admin.getUserById(id)
      if (missing.error?.status !== 404 || missing.data.user) errors.push('fixture account still exists or deletion could not be verified')
    }
  }
  for (const email of bootstrapEmails) {
    const result = await admin.from('admin_bootstrap').delete().eq('email',email)
    if (result.error) errors.push('fixture bootstrap cleanup failed')
  }
  for (const code of studentCodes) {
    const result = await admin.from('student_codes').delete().eq('code', code).select('code')
    if (result.error || result.data?.length !== 1) errors.push('fixture student code cleanup failed')
  }
  if (studentCodes.length) {
    const remaining = await admin.from('student_codes').select('code').in('code', studentCodes)
    if (remaining.error || remaining.data?.length !== 0) errors.push('fixture student code deletion could not be verified')
  }
  assert.deepEqual(errors,[])
})
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exitCode = failed ? 1 : 0
