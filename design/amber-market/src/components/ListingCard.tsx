import { ArrowUpRight, BadgeCheck, Heart, Star } from "lucide-react";
import { imagePath, priceLabel, type Listing } from "../data";

export function ListingCard({
  listing,
  saved,
  onSave,
  onOpen,
  featured = false,
}: {
  listing: Listing;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  featured?: boolean;
}) {
  return (
    <article className={`listing-card ${featured ? "listing-featured" : ""}`}>
      <button
        className="listing-image"
        onClick={onOpen}
        type="button"
        aria-label={`View ${listing.title}`}
      >
        <img
          src={imagePath(listing)}
          alt={listing.title}
          loading="lazy"
          width="1000"
          height="750"
        />
        {listing.badge && (
          <span className="photo-badge">
            {featured && <span className="tiny-star">✳</span>}
            {listing.badge}
          </span>
        )}
        {featured && (
          <span className="photo-caption">PRE-LOVED. RE-IMAGINED.</span>
        )}
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </button>
      <button
        className={`save-button ${saved ? "is-saved" : ""}`}
        type="button"
        onClick={onSave}
        aria-label={`${saved ? "Unsave" : "Save"} ${listing.title}`}
        aria-pressed={saved}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="listing-body">
        <div className="listing-meta">
          <span>{listing.category}</span>
          <span
            className={`kind-label ${listing.kind === "Free" ? "is-free" : ""}`}
          >
            {listing.kind === "Buy"
              ? "For sale"
              : listing.kind === "Rent"
                ? "For rent"
                : "Giveaway"}
          </span>
        </div>
        <button className="listing-title" type="button" onClick={onOpen}>
          {listing.title}
        </button>
        <div className="listing-price">
          <strong>{priceLabel(listing)}</strong>
          {listing.kind === "Rent" && <span> / day</span>}
          <span className="condition">{listing.condition}</span>
        </div>
        <div className="seller-line">
          <span className={`avatar avatar-${listing.id % 4}`}>
            {listing.initials}
          </span>
          <span>
            {listing.seller}
            <BadgeCheck size={13} aria-label="Example campus badge" />
          </span>
          <span className="seller-rating">
            <Star size={11} fill="currentColor" />
            {listing.rating}
          </span>
        </div>
      </div>
    </article>
  );
}
