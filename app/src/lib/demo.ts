// Dev-only in-memory stand-in for Supabase so the UI can be previewed without a backend.
// Enabled with VITE_DEMO=1 (see README). Never used in production builds without that flag.
const now = Date.now()
const me = { id: 'u1', email: 'you@iiitd.ac.in', display_name: 'Aarav Mehta', batch: '2027', role: 'admin', status: 'approved' }
const people = [me, { id: 'u2', display_name: 'Ishita Rao', batch: '2026' }, { id: 'u3', display_name: 'Kabir Nair', batch: '2028' }]
const mk = (i: number, o: Record<string, unknown> & { title: string }) => ({
  id: 'l' + i, seller_id: 'u2', description: 'Well kept, used for one semester. Happy to show it before you buy. Pickup near the hostel lobby after 6pm works best.',
  negotiable: false, pickup_area: 'Hostel lobby', rental_period: null, deposit_inr: null, status: 'active',
  created_at: new Date(now - i * 86400000 * 0.7).toISOString(), photos: ['p' + i], condition: 'good', ...o,
})
const listings = [
  mk(1, { title: 'Hero Sprint 21-speed cycle', listing_type: 'sale', category: 'cycles', price_inr: 4200, negotiable: true }),
  mk(2, { title: 'CLRS Introduction to Algorithms, 3rd ed.', listing_type: 'sale', category: 'books', price_inr: 450, condition: 'like_new' }),
  mk(3, { title: 'Philips 1000W induction cooktop', listing_type: 'rent', category: 'hostel', price_inr: 150, rental_period: 'per week', deposit_inr: 500 }),
  mk(4, { title: 'Study table with drawer', listing_type: 'giveaway', category: 'furniture', price_inr: 0, condition: 'fair', status: 'reserved' }),
  mk(5, { title: 'Casio fx-991EX scientific calculator', listing_type: 'sale', category: 'electronics', price_inr: 900, status: 'sold', condition: 'new' }),
  mk(6, { title: 'Yonex badminton racquet with cover', listing_type: 'sale', category: 'sports', price_inr: 1100, negotiable: true }),
  mk(7, { title: 'Denim jacket, size M', listing_type: 'sale', category: 'clothing', price_inr: 600 }),
  mk(8, { title: 'Bedside lamp with USB port', listing_type: 'sale', category: 'hostel', price_inr: 250, condition: 'like_new' }),
].map((l) => ({ ...l, seller: people[1] }))
const conv = { id: 'c1', listing_id: 'l1', buyer_id: 'u1', seller_id: 'u2', created_at: new Date(now).toISOString(), listing: { title: listings[0].title, photos: ['p1'], status: 'active' }, buyer: me, seller: people[1] }
const messages = [
  { id: 'm1', conversation_id: 'c1', sender_id: 'u1', body: 'Hi! Is the cycle still available?', image_path: null, created_at: new Date(now - 7200000).toISOString(), read_at: new Date(now - 7000000).toISOString() },
  { id: 'm2', conversation_id: 'c1', sender_id: 'u2', body: 'Yes it is. I can meet at the library after 5.', image_path: null, created_at: new Date(now - 6800000).toISOString(), read_at: null },
]
const tables: Record<string, unknown[]> = {
  profiles: [me, ...people.slice(1).map((p) => ({ ...p, email: p.id + '@iiitd.ac.in', role: 'student', status: 'approved' }))],
  listings, conversations: [conv], messages, saved_items: [{ listing: listings[1] }],
  offers: [{ id: 'o1', amount_inr: 3800, listing: { title: listings[0].title }, status: 'accepted' }],
  reports: [{ id: 'r1', reason: 'Looks like a duplicate of another listing', status: 'open', listing_id: 'l6', reporter: { display_name: 'Kabir Nair' } }],
}
const palette = ['#e9d9c3', '#cfd9cc', '#d9cdd6', '#e6c9b8', '#c9d3dc', '#dfd6b6']
const photo = (p: string) => {
  const c = palette[(parseInt(p.replace(/\D/g, ''), 10) || 0) % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="${c}"/><circle cx="200" cy="230" r="90" fill="#2b2622" opacity=".14"/><rect x="120" y="330" width="160" height="14" rx="7" fill="#2b2622" opacity=".14"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
function builder(table: string) {
  const rows = tables[table] ?? []
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'neq', 'in', 'or', 'lte', 'order', 'limit', 'insert', 'update', 'upsert', 'delete']) b[m] = chain
  b.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
  b.single = b.maybeSingle
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok)
  return b
}
const channel = { on: () => channel, subscribe: () => channel }
export const demoClient = {
  from: builder,
  rpc: () => Promise.resolve({ data: [{ conversation_id: 'c1', unread: 1 }], error: null }),
  channel: () => channel,
  removeChannel: () => Promise.resolve(),
  storage: { from: () => ({ createSignedUrls: (paths: string[]) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: photo(p) })) }), upload: () => Promise.resolve({ error: null }) }) },
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve(),
    signInWithOAuth: () => Promise.resolve({ error: null }),
  },
}
