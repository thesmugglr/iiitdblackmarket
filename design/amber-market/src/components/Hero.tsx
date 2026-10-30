import { ArrowRight, ArrowUpRight, BadgeCheck, Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { imagePath, priceLabel, type Listing } from "../data";

export function Hero({
  featured,
  query,
  onQuery,
  onSearch,
  onCategory,
  onOpen,
}: {
  featured: Listing[];
  query: string;
  onQuery: (q: string) => void;
  onSearch: () => void;
  onCategory: (c: string) => void;
  onOpen: (l: Listing) => void;
}) {
  const calm = useReducedMotion();
  return (
    <section className="hero content-width" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <div className="hero-kicker">
          <span className="small-line" />
          FROM ONE CAMPUS LIFE TO ANOTHER
        </div>
        <h1 id="hero-heading">
          Good things.
          <br />
          <em>Another chapter.</em>
        </h1>
        <p className="hero-description">
          The things you need. The people you know.
          <br className="desktop-break" /> Buy, sell, or borrow a little closer
          to home.
        </p>
        <form
          className="hero-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
        >
          <Search size={19} aria-hidden="true" />
          <input
            aria-label="Search campus finds"
            placeholder="What are you looking for?"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <button type="submit" aria-label="Search finds">
            <ArrowRight size={20} />
          </button>
        </form>
        <div className="hero-chips">
          <span>A LITTLE INSPIRATION</span>
          {["Books", "Headphones", "Room finds"].map((c) => (
            <button type="button" key={c} onClick={() => onCategory(c)}>
              {c}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        <div className="hero-bottom">
          <span className="hero-seal">
            <BadgeCheck size={19} />
          </span>
          <p>
            A smaller circle.
            <br />
            <strong>A better way to pass things on.</strong>
          </p>
          <span className="hero-bottom-line" />
        </div>
      </div>
      <div
        className="hero-collage"
        aria-label="A few illustrative campus finds"
      >
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <span className="collage-star star-one" aria-hidden="true">
          ✳
        </span>
        {featured.slice(0, 3).map((l, i) => (
          <motion.button
            className={`floating-card floating-${i}`}
            key={l.id}
            type="button"
            onClick={() => onOpen(l)}
            aria-label={`Preview ${l.title}`}
            initial={
              calm
                ? false
                : { opacity: 0, y: 22, rotate: i === 0 ? -7 : i === 1 ? 8 : -5 }
            }
            animate={{
              opacity: 1,
              y: 0,
              rotate: i === 0 ? -7 : i === 1 ? 8 : -5,
            }}
            transition={{ duration: 0.7, delay: i * 0.13 + 0.1 }}
            whileHover={calm ? undefined : { y: -7, rotate: 0 }}
          >
            <div className="floating-image">
              <img
                src={imagePath(l)}
                alt=""
                width="500"
                height="400"
                fetchPriority={i === 0 ? "high" : "auto"}
              />
              <span>
                {l.kind === "Rent"
                  ? "Borrow it"
                  : l.kind === "Free"
                    ? "Pass it on"
                    : "Good as new"}
              </span>
            </div>
            <div className="floating-info">
              <span>
                {i === 0
                  ? "For your daily soundtrack"
                  : i === 1
                    ? "A different point of view"
                    : "One more good read"}
              </span>
              <strong>
                {priceLabel(l)}
                {l.kind === "Rent" && <small> / day</small>}
              </strong>
              <span className="floating-seller">
                <span className="floating-dot" />
                {l.seller}
                <BadgeCheck size={12} />
              </span>
            </div>
          </motion.button>
        ))}
        <div className="collage-note">
          <span>
            LESS NEW.
            <br />
            <em>More you.</em>
          </span>
          <svg viewBox="0 0 70 60" aria-hidden="true">
            <path
              d="M8 4c-6 33 24 46 48 35m-14-4 17 2-7 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="collage-star star-two" aria-hidden="true">
          +
        </span>
        <span className="collage-edition">THE CAMPUS EDIT / VOL. 01</span>
      </div>
    </section>
  );
}
