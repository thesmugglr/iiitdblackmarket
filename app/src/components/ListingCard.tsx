import { Link } from 'react-router-dom'
import { CATEGORIES, inr } from '../lib/constants'
import { useSignedUrls } from '../lib/useSignedUrls'
import type { Listing } from '../lib/types'

export function priceLabel(l: Pick<Listing, 'listing_type' | 'price_inr'>) {
  if (l.listing_type === 'giveaway') return 'Free'
  return inr(l.price_inr) + (l.listing_type === 'rent' ? ' rent' : '')
}

export default function ListingCard({ l }: { l: Listing }) {
  const [url] = useSignedUrls('listing-photos', l.photos.slice(0, 1))
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className={`thumb ${l.status !== 'active' ? 'dim' : ''}`}>
        {url ? <img src={url} alt={l.title} loading="lazy" /> : <span>No photo</span>}
        {l.status !== 'active' && <span className={`stamp ${l.status}`}>{l.status}</span>}
        {l.listing_type !== 'sale' && <span className="tag">{l.listing_type === 'rent' ? 'For rent' : 'Free'}</span>}
      </div>
      <div className="card-body">
        <div className="title">{l.title}</div>
        <div className="row-between">
          <span className="price">{priceLabel(l)}</span>
          <span className="meta">{CATEGORIES[l.category].split(' ')[0]}</span>
        </div>
      </div>
    </Link>
  )
}
