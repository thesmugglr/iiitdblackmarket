import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { inr } from '../lib/constants'
import { usePhotoThumbs } from '../lib/useSignedUrls'
import Sections from '../components/Sections'
import type { Bundle } from '../lib/types'

function BundleCard({ b }: { b: Bundle }) {
  const photos = (b.items ?? []).map((i) => i.listing?.photos[0]).filter((p): p is string => Boolean(p)).slice(0, 3)
  const urls = usePhotoThumbs(photos)
  const total = (b.items ?? []).reduce((n, i) => n + (i.listing?.price_inr ?? 0), 0)
  return (
    <Link to={`/bundles/${b.id}`} className="card bundle">
      <div className="stack">{urls.map((u, i) => u && <img key={i} src={u} alt="" style={{ transform: `rotate(${(i - 1) * 5}deg) translateX(${(i - 1) * 18}px)` }} />)}</div>
      <div className="card-body">
        <div className="title">{b.title}</div>
        <div className="row-between"><span className="price">{inr(b.price_inr)}</span><span className="meta">{b.items?.length ?? 0} items</span></div>
        {total > b.price_inr && <div className="small muted">Worth {inr(total)} separately</div>}
        {b.status !== 'active' && <span className={`badge ${b.status}`}>{b.status}</span>}
      </div>
    </Link>
  )
}

export default function Bundles() {
  const [items, setItems] = useState<Bundle[] | null>(null)
  useEffect(() => {
    supabase.from('bundles').select('*, items:bundle_items(listing:listings(id,title,photos,price_inr))').neq('status', 'removed').order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => setItems((data ?? []) as unknown as Bundle[]))
  }, [])
  return (
    <>
      <Sections />
      <div className="row between"><h1>Moving-out bundles</h1><Link to="/bundles/new" className="btn primary">Make a bundle</Link></div>
      <p className="muted">Whole hostel setups at one price, from people leaving campus.</p>
      {!items && <p className="muted">Loading…</p>}
      {items?.length === 0 && <div className="empty"><strong>No bundles yet</strong><span>Group two or more of your listings into a single deal.</span></div>}
      <div className="grid">{items?.map((b) => <BundleCard key={b.id} b={b} />)}</div>
    </>
  )
}
