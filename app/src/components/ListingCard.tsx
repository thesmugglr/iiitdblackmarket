import { Link } from 'react-router-dom'
import { CATEGORIES, inr } from '../lib/constants'
import { usePhotoThumbs } from '../lib/useSignedUrls'
import { Heart } from './Icons'
import type { Listing } from '../lib/types'

export function priceLabel(l: Pick<Listing, 'listing_type' | 'price_inr'>) {
  if (l.listing_type === 'giveaway') return 'Free'
  return inr(l.price_inr) + (l.listing_type === 'rent' ? ' rent' : '')
}

interface Props { l: Listing; feature?: boolean; saved?: boolean; onSave?: (l: Listing) => void }

export default function ListingCard({ l, feature, saved, onSave }: Props) {
  const [url] = usePhotoThumbs(l.photos.slice(0, 1))
  return (
    <div className={`card ${feature ? 'feature' : ''}`}>
      <Link to={`/listing/${l.id}`} className="card-link" aria-label={`${l.title}, ${priceLabel(l)}`}>
        <div className={`thumb ${l.status !== 'active' ? 'dim' : ''}`}>
          {url ? <img src={url} alt="" loading="lazy" /> : <span>No photo</span>}
          {l.status !== 'active' && <span className={`stamp ${l.status}`}>{l.status}</span>}
          {l.listing_type !== 'sale' && <span className="tag">{l.listing_type === 'rent' ? 'For rent' : 'Free'}</span>}
        </div>
        <div className="card-body">
          <div className="title">{l.title}</div>
          <div className="row-between">
            <span className="price">{priceLabel(l)}</span>
            <span className="meta">{l.pickup_area ?? CATEGORIES[l.category]}</span>
          </div>
        </div>
      </Link>
      {onSave && (
        <button className={`heart ${saved ? 'on' : ''}`} aria-pressed={saved} aria-label={saved ? `Unsave ${l.title}` : `Save ${l.title}`} onClick={() => onSave(l)}>
          <Heart filled={saved} />
        </button>
      )}
    </div>
  )
}
