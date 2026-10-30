import { Link } from 'react-router-dom'
import { CATEGORIES, inr } from '../lib/constants'
import { useSignedUrls } from '../lib/useSignedUrls'
import type { Listing } from '../lib/types'

export function priceLabel(l: Pick<Listing, 'listing_type' | 'price_inr'>) {
  if (l.listing_type === 'giveaway') return 'Free'
  return inr(l.price_inr) + (l.listing_type === 'rent' ? ' / rental' : '')
}

export default function ListingCard({ l }: { l: Listing }) {
  const [url] = useSignedUrls('listing-photos', l.photos.slice(0, 1))
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className="thumb">{url ? <img src={url} alt={l.title} loading="lazy" /> : <span>No photo</span>}</div>
      <div className="card-body">
        <div className="price">{priceLabel(l)}</div>
        <div className="title">{l.title}</div>
        <div className="muted small">
          {CATEGORIES[l.category]} · {l.listing_type}
          {l.status !== 'active' && <span className={`badge ${l.status}`}>{l.status}</span>}
        </div>
      </div>
    </Link>
  )
}
