// Dev-only in-memory stand-in for Supabase so the UI can be previewed without a backend.
// Enabled with VITE_DEMO=1 on the dev server only. Production builds exclude it.
const now = Date.now()
const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const me = { id: fixtureId(1), email: 'you@iiitd.ac.in', display_name: 'Aarav Mehta', batch: '2027', role: 'admin', status: 'approved', created_at: new Date(now).toISOString() }
const people = [me, { id: fixtureId(2), display_name: 'Ishita Rao', batch: '2026' }, { id: fixtureId(3), display_name: 'Kabir Nair', batch: '2028' }]
const mk = (i: number, o: Record<string, unknown> & { title: string }) => ({
  id: 'l' + i, seller_id: people[1].id, description: 'Well kept, used for one semester. Happy to show it before you buy. Pickup near the hostel lobby after 6pm works best.',
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
const conv = { id: 'c1', listing_id: 'l1', buyer_id: me.id, seller_id: people[1].id, created_at: new Date(now).toISOString(), listing: { title: listings[0].title, photos: ['p1'], status: 'active' }, buyer: me, seller: people[1] }
const messages = [
  { id: 'm1', conversation_id: 'c1', sender_id: me.id, body: 'Hi! Is the cycle still available?', image_path: null, created_at: new Date(now - 7200000).toISOString(), read_at: new Date(now - 7000000).toISOString() },
  { id: 'm2', conversation_id: 'c1', sender_id: people[1].id, body: 'Yes it is. I can meet at the library after 5.', image_path: null, created_at: new Date(now - 6800000).toISOString(), read_at: null },
]
const tables: Record<string, unknown[]> = {
  profiles: [me, ...people.slice(1).map((p, i) => ({ ...p, email: `student${i + 2}@iiitd.ac.in`, role: 'student', status: 'approved', created_at: new Date(now - (i + 1) * 86400000).toISOString() }))],
  listings, conversations: [conv], messages, saved_items: [{ listing: listings[1] }],
  offers: [{ id: 'o1', amount_inr: 3800, listing: { title: listings[0].title }, status: 'accepted' }],
  notifications: [
    { id: 'n1', kind: 'message', title: 'New message about Hero Sprint 21-speed cycle', link: '/inbox/c1', read_at: null, created_at: new Date(now - 600000).toISOString() },
    { id: 'n2', kind: 'expiry', title: '"Bedside lamp with USB port" expires soon. Renew it to keep it listed.', link: '/listing/l8', read_at: null, created_at: new Date(now - 86400000).toISOString() },
    { id: 'n3', kind: 'wanted', title: 'Someone has what you are looking for: "A second-hand kettle"', link: '/listing/l3', read_at: new Date(now).toISOString(), created_at: new Date(now - 172800000).toISOString() },
  ],
  wanted_posts: [
    { id: 'w1', user_id: people[2].id, title: 'Second-hand kettle', description: 'Anything under a litre works. Need it before exams.', category: 'hostel', max_price_inr: 400, status: 'open', created_at: new Date(now - 3600000).toISOString(), poster: people[2] },
    { id: 'w2', user_id: me.id, title: 'Used cycle lock', description: '', category: 'cycles', max_price_inr: null, status: 'open', created_at: new Date(now - 86400000).toISOString(), poster: me },
  ],
  bundles: [
    { id: 'b1', seller_id: people[1].id, title: 'Hostel room starter kit', description: 'Leaving campus this month. Everything works, pickup together from the hostel lobby.', price_inr: 300, status: 'active', created_at: new Date(now).toISOString(), seller: people[1], items: [{ listing: listings[2] }, { listing: listings[7] }, { listing: listings[3] }] },
  ],
  reports: [{ id: fixtureId(101), reason: 'Looks like a duplicate of another listing', status: 'open', listing_id: 'l6', message_id: null, reporter_id: people[2].id, reporter: { display_name: 'Kabir Nair' }, created_at: new Date(now - 3600000).toISOString() }],
}
const palette = ['#E8E1D5', '#FFD9CE', '#D9E3D0', '#EADFC8', '#D6DCE4', '#F2CFC2']
const photo = (p: string) => {
  const c = palette[(parseInt(p.replace(/\D/g, ''), 10) || 0) % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="${c}"/><circle cx="200" cy="230" r="90" fill="#1A1A1A" opacity=".16"/><rect x="120" y="330" width="160" height="14" rx="7" fill="#1A1A1A" opacity=".16"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
function builder(table: string) {
  let rows = [...(tables[table] ?? [])] as Record<string, unknown>[]
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'neq', 'in', 'or', 'lte', 'is', 'gt', 'order', 'limit', 'insert', 'update', 'upsert', 'delete']) b[m] = chain
  // Only the administrator read contract is modeled here. Other preview
  // queries/actions remain visual stand-ins, not a Supabase emulator.
  const orders: { key: string; ascending: boolean }[] = []
  let limit = Infinity
  if (table === 'profiles' || table === 'reports') {
    b.eq = (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return b }
    b.order = (key: string, options: { ascending?: boolean } = {}) => { orders.push({ key, ascending: options.ascending !== false }); return b }
    b.limit = (value: number) => { limit = value; return b }
    b.or = (expression: string) => {
      const match = /^created_at\.(lt|gt)\."([^"]+)",and\(created_at\.eq\."\2",id\.\1\.([0-9a-f-]+)\)$/.exec(expression)
      if (!match) throw new Error('This administrator preview query is unsupported.')
      const [, op, time, id] = match
      rows = rows.filter(row => op === 'lt'
        ? String(row.created_at) < time || (row.created_at === time && String(row.id) < id)
        : String(row.created_at) > time || (row.created_at === time && String(row.id) > id))
      return b
    }
  }
  const read = () => [...rows].sort((a, b) => {
    for (const { key, ascending } of orders) {
      const order = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
      if (order) return ascending ? order : -order
    }
    return 0
  }).slice(0, limit)
  b.maybeSingle = () => Promise.resolve({ data: read()[0] ?? null, error: null })
  b.single = b.maybeSingle
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: read(), error: null, count: rows.length }).then(ok)
  return b
}
const channel = { on: () => channel, subscribe: () => channel }
export const demoClient = {
  from: builder,
  rpc: (name: string) => {
    if (name === 'my_profile') return { maybeSingle: () => Promise.resolve({ data: me, error: null }) }
    if (name === 'admin_profiles') return builder('profiles')
    return Promise.resolve({ data: [{ conversation_id: 'c1', unread: 1 }], error: null })
  },
  channel: () => channel,
  removeChannel: () => Promise.resolve(),
  storage: { from: () => ({ createSignedUrls: (paths: string[]) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: photo(p) })) }), upload: () => Promise.resolve({ error: null }) }) },
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: me.id } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve(),
    signInWithOAuth: () => Promise.resolve({ error: null }),
  },
}
