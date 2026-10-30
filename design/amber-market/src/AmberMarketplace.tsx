import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bike,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Grid2X2,
  Heart,
  Headphones,
  LampDesk,
  MapPin,
  Menu,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  listings as initialListings,
  categories,
  imagePath,
  priceLabel,
  type Listing,
  type Category,
  type ListingKind,
} from "./data";
import { Brand, Modal, Reveal } from "./components/Primitives";
import { Hero } from "./components/Hero";
import { ListingCard } from "./components/ListingCard";
import { StorySections } from "./components/StorySections";
import { AccessInfo, CreateListing } from "./components/PreviewForms";

type Overlay =
  | { type: "detail"; listing: Listing }
  | { type: "create" | "access" | "about" }
  | null;
const categoryIcons = [Grid2X2, Headphones, BookOpen, LampDesk, Bike, Sparkles];

export function AmberMarketplace() {
  const [items, setItems] = useState(initialListings);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All finds");
  const [kind, setKind] = useState<"All" | ListingKind>("All");
  const [sort, setSort] = useState("curated");
  const [condition, setCondition] = useState("Any condition");
  const [maxPrice, setMaxPrice] = useState("");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const scrollToFinds = () =>
    document
      .getElementById("marketplace")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  const reset = () => {
    setQuery("");
    setCategory("All finds");
    setKind("All");
    setSort("curated");
    setCondition("Any condition");
    setMaxPrice("");
    setSavedOnly(false);
    setShowAll(false);
  };
  const toggleSaved = (id: number) =>
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = items.filter(
      (l) =>
        (!q ||
          `${l.title} ${l.category} ${l.description}`
            .toLowerCase()
            .includes(q)) &&
        (category === "All finds" || l.category === category) &&
        (kind === "All" || l.kind === kind) &&
        (condition === "Any condition" || l.condition === condition) &&
        (!maxPrice || l.price <= Number(maxPrice)) &&
        (!savedOnly || saved.has(l.id)),
    );
    if (sort === "low") found.sort((a, b) => a.price - b.price);
    if (sort === "high") found.sort((a, b) => b.price - a.price);
    if (sort === "newest") found.sort((a, b) => b.id - a.id);
    return found;
  }, [
    items,
    query,
    category,
    kind,
    sort,
    condition,
    maxPrice,
    savedOnly,
    saved,
  ]);
  const narrowed =
    !!query ||
    category !== "All finds" ||
    kind !== "All" ||
    condition !== "Any condition" ||
    !!maxPrice ||
    savedOnly ||
    sort !== "curated";
  const shown = showAll || narrowed ? filtered : filtered.slice(0, 5);
  const bento = !narrowed && !showAll && shown.length === 5;
  const activeFilters =
    Number(condition !== "Any condition") +
    Number(!!maxPrice) +
    Number(sort !== "curated");
  const heroFeatured = [
    initialListings[0],
    initialListings[3],
    initialListings[2],
  ];
  const openAccess = () => {
    setMenu(false);
    setOverlay({ type: "access" });
  };
  return (
    <div id="top" className="amber-market">
      <a className="skip-link" href="#marketplace">
        Skip to marketplace
      </a>
      <div className="preview-bar">
        <span className="preview-dot" /> An idea for the campus circle{" "}
        <span className="preview-separator">/</span>
        <button type="button" onClick={() => setOverlay({ type: "about" })}>
          Design preview · sample listings <ArrowUpRight size={11} />
        </button>
      </div>
      <header className="navbar-wrap">
        <div className="navbar content-width">
          <a href="#top" aria-label="Blackmarket home">
            <Brand />
          </a>
          <nav
            className={`main-nav ${menu ? "is-open" : ""}`}
            aria-label="Main navigation"
          >
            <a href="#marketplace" onClick={() => setMenu(false)}>
              Marketplace
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              How it works
            </a>
            <a href="#campus-circle" onClick={() => setMenu(false)}>
              The campus circle
            </a>
          </nav>
          <div className="nav-actions">
            <button
              className={`nav-save ${savedOnly ? "active" : ""}`}
              type="button"
              aria-label={`Saved finds, ${saved.size} saved`}
              aria-pressed={savedOnly}
              onClick={() => {
                setSavedOnly(!savedOnly);
                setShowAll(true);
                scrollToFinds();
              }}
            >
              <Heart size={19} fill={savedOnly ? "currentColor" : "none"} />
              {saved.size > 0 && <span>{saved.size}</span>}
            </button>
            <span className="nav-divider" />
            <button type="button" className="sign-in" onClick={openAccess}>
              Student sign in <ArrowUpRight size={13} />
            </button>
            <button
              className="primary-button nav-list"
              aria-label="List an item"
              type="button"
              onClick={() => setOverlay({ type: "create" })}
            >
              <Plus size={15} />
              <span className="nav-list-text">List an item</span>
              <span className="nav-list-short" aria-hidden="true">
                List
              </span>
            </button>
            <button
              className="mobile-menu icon-button"
              type="button"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <Hero
          featured={heroFeatured}
          query={query}
          onQuery={setQuery}
          onSearch={scrollToFinds}
          onCategory={(c) => {
            setQuery(c === "Headphones" ? "headphones" : "");
            setCategory(
              c === "Books"
                ? "Books & notes"
                : c === "Room finds"
                  ? "Room essentials"
                  : "Electronics",
            );
            scrollToFinds();
          }}
          onOpen={(listing) => setOverlay({ type: "detail", listing })}
        />
        <div className="values-band content-width">
          <span>
            <BadgeCheck size={16} />A campus-sized community
          </span>
          <span className="values-dash" />
          <span>
            <MapPin size={15} />
            Always a little closer
          </span>
          <span className="values-dash" />
          <span>
            <Sparkles size={16} />
            Less waste. More possibility.
          </span>
        </div>
        <section
          className="category-section content-width"
          aria-label="Find your corner"
        >
          <div className="category-heading">
            <p className="eyebrow">FIND YOUR CORNER</p>
            <span>Little things. Big possibilities.</span>
          </div>
          <div className="category-list">
            {categories.map((c, i) => {
              const Icon = categoryIcons[i];
              return (
                <button
                  type="button"
                  className={`category-pill ${category === c ? "selected" : ""}`}
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setSavedOnly(false);
                    scrollToFinds();
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  {c}
                </button>
              );
            })}
          </div>
        </section>
        <section
          className="finds-section content-width section-space"
          id="marketplace"
          aria-labelledby="finds-heading"
        >
          <Reveal className="section-heading finds-heading">
            <div>
              <p className="eyebrow">PRE-LOVED. RE-IMAGINED.</p>
              <h2 id="finds-heading">
                {savedOnly
                  ? "Your little collection."
                  : query
                    ? "A few things for you."
                    : "Fresh finds, familiar faces."}
              </h2>
              <p className="section-description">
                {savedOnly
                  ? "The things you’d like to come back to."
                  : "Good things looking for their next favourite person."}
              </p>
            </div>
            <button
              className="filter-button"
              type="button"
              onClick={() => setFilters(true)}
            >
              <SlidersHorizontal size={15} />
              Filters & sort{activeFilters > 0 && <span>{activeFilters}</span>}
              <ChevronDown size={14} />
            </button>
          </Reveal>
          <div className="finds-toolbar">
            <div className="type-tabs" role="group" aria-label="Listing types">
              {(["All", "Buy", "Rent", "Free"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  className={kind === k ? "selected" : ""}
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                >
                  {k === "All" ? "All finds" : k === "Free" ? "Giveaways" : k}
                </button>
              ))}
            </div>
            <span className="sample-counter">
              {filtered.length} sample finds
              {savedOnly ? " · saved collection" : ""}
            </span>
          </div>
          {(query || category !== "All finds" || savedOnly) && (
            <div className="active-search">
              <span>
                {query ? `“${query}”` : savedOnly ? "Saved finds" : category}
              </span>
              <button type="button" onClick={reset}>
                Clear <X size={12} />
              </button>
            </div>
          )}
          {loading ? (
            <div
              className="listing-grid skeleton-grid"
              aria-label="Loading sample finds"
              aria-busy="true"
            >
              {[0, 1, 2].map((i) => (
                <div className="listing-skeleton" key={i}>
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                {savedOnly ? (
                  <Heart size={32} strokeWidth={1} />
                ) : (
                  <CircleHelp size={32} strokeWidth={1} />
                )}
              </span>
              <h3>
                {savedOnly
                  ? "A little room for favourites."
                  : "Nothing here. Yet."}
              </h3>
              <p>
                {savedOnly
                  ? "Tap a heart on a find you love. It’ll be waiting for you here."
                  : "Try a different search or loosen a filter. Your next good find might be one click away."}
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={reset}
              >
                Back to all finds <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className={`listing-grid ${bento ? "is-bento" : ""}`}>
              {shown.map((listing, i) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  saved={saved.has(listing.id)}
                  onSave={() => toggleSaved(listing.id)}
                  onOpen={() => setOverlay({ type: "detail", listing })}
                  featured={bento && i === 0}
                />
              ))}
            </div>
          )}
          {!narrowed && (
            <div className="more-finds">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "A little less, please"
                  : `Explore all ${items.length} finds`}
                <ArrowDown size={15} className={showAll ? "rotate-180" : ""} />
              </button>
              <p>Illustrative listings. Real possibilities.</p>
            </div>
          )}
        </section>
        <StorySections
          onCreate={() => setOverlay({ type: "create" })}
          onAbout={() => setOverlay({ type: "about" })}
        />
      </main>
      <Modal
        open={filters}
        onClose={() => setFilters(false)}
        title="Make it your kind of find"
        drawer
      >
        <div className="filter-content">
          <h2>
            A little
            <br />
            <em>more specific.</em>
          </h2>
          <p>Find the things that fit your life.</p>
          <label>
            Condition
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              {["Any condition", "Like new", "Good", "Well loved"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Maximum price (₹)
            <input
              type="number"
              min="0"
              placeholder="A little flexibility"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
          <label>
            Sort the good stuff
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="curated">The campus edit</option>
              <option value="newest">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </label>
          <div className="filter-bottom">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setFilters(false);
                setShowAll(true);
                scrollToFinds();
              }}
            >
              Show {filtered.length} finds <ArrowRight size={16} />
            </button>
            <button type="button" className="text-link" onClick={reset}>
              Reset filters
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={overlay !== null}
        onClose={() => setOverlay(null)}
        title={
          overlay?.type === "detail"
            ? "A closer look"
            : overlay?.type === "create"
              ? "Pass something on"
              : overlay?.type === "about"
                ? "A little context"
                : "Campus access"
        }
      >
        {overlay?.type === "detail" && (
          <div className="detail-view">
            <div className="detail-image">
              <img
                src={imagePath(overlay.listing)}
                alt={overlay.listing.title}
              />
              <span className="photo-badge">Sample listing</span>
            </div>
            <div className="detail-copy">
              <p className="eyebrow">{overlay.listing.category}</p>
              <h2>{overlay.listing.title}</h2>
              <div className="detail-price">
                {priceLabel(overlay.listing)}
                {overlay.listing.kind === "Rent" && <small> / day</small>}
              </div>
              <p>{overlay.listing.description}</p>
              <div className="detail-facts">
                <span>
                  <MapPin size={15} />
                  {overlay.listing.location}
                </span>
                <span>
                  <Check size={15} />
                  {overlay.listing.condition}
                </span>
              </div>
              <div className="detail-seller">
                <span className="avatar avatar-1">
                  {overlay.listing.initials}
                </span>
                <div>
                  <strong>{overlay.listing.seller}</strong>
                  <span>{overlay.listing.batch} · sample profile</span>
                </div>
                <span className="stars">
                  <Star size={12} fill="currentColor" />
                  {overlay.listing.rating}
                </span>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => setOverlay({ type: "access" })}
              >
                Meet your campus circle <ArrowUpRight size={17} />
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => toggleSaved(overlay.listing.id)}
              >
                <Heart
                  size={16}
                  fill={saved.has(overlay.listing.id) ? "currentColor" : "none"}
                />
                {saved.has(overlay.listing.id)
                  ? "Saved for later"
                  : "Save this find"}
              </button>
            </div>
          </div>
        )}
        {overlay?.type === "access" && (
          <AccessInfo onClose={() => setOverlay(null)} />
        )}
        {overlay?.type === "create" && (
          <CreateListing
            onCreate={(listing) => {
              setItems((current) => [listing, ...current]);
              reset();
              setShowAll(true);
              setOverlay(null);
              setToast(
                "Your preview listing is here. It’s only in this browser session.",
              );
              setTimeout(scrollToFinds, 80);
            }}
          />
        )}
        {overlay?.type === "about" && (
          <div className="about-preview">
            <p className="eyebrow">THE AMBER EDITION</p>
            <h2>
              A little mood.
              <br />
              <em>A lot of possibility.</em>
            </h2>
            <p>
              This is an isolated design concept for IIITD Black Market. The
              twelve listings, seller profiles, badges, ratings, and quotes are
              illustrative samples.
            </p>
            <p>
              Search, filters, saved finds, and preview listings work in this
              browser session. Real sign-in, trades, chats, and email
              subscriptions are handled separately in the main project.
            </p>
            <p>
              Created as a parallel visual proposal while Abhik continues the
              production website. Nothing here changes the live marketplace.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setOverlay(null)}
            >
              Take a look around <ArrowRight size={16} />
            </button>
          </div>
        )}
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
