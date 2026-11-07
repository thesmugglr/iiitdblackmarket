import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../lib/constants'
import { usePhotoThumbs } from '../lib/useSignedUrls'
import { priceLabel } from './ListingCard'
import { Search } from './Icons'
import type { Listing } from '../lib/types'

const SLOTS = [
  { top: '0%', left: '4%', rot: -4, w: '40%', dy: 8 },
  { top: '16%', left: '56%', rot: 4, w: '40%', dy: -10 },
  { top: '56%', left: '24%', rot: 2, w: '40%', dy: 6 },
]

function Floating({ l, slot, i }: { l: Listing; slot: (typeof SLOTS)[number]; i: number }) {
  const [url] = usePhotoThumbs(l.photos.slice(0, 1))
  const calm = useReducedMotion()
  return (
    <motion.div className="float-card glass" style={{ top: slot.top, left: slot.left, width: slot.w, rotate: slot.rot }}
      initial={calm ? false : { opacity: 0, scale: 0.9 }} animate={calm ? undefined : { opacity: 1, scale: 1, y: [0, slot.dy, 0] }}
      transition={{ opacity: { delay: 0.2 + i * 0.15 }, scale: { delay: 0.2 + i * 0.15 }, y: { duration: 6 + i, repeat: Infinity, ease: 'easeInOut' } }}>
      <Link to={`/listing/${l.id}`}>
        <div className="thumb">{url ? <img src={url} alt="" /> : <span>No photo</span>}</div>
        <div className="float-meta"><span>{l.title}</span><strong>{priceLabel(l)}</strong></div>
      </Link>
    </motion.div>
  )
}

interface Props { q: string; setQ: (v: string) => void; category: string; setCategory: (v: string) => void; featured: Listing[]; onSubmit: () => void }
export default function Hero({ q, setQ, category, setCategory, featured, onSubmit }: Props) {
  return (
    <section className="hero" aria-labelledby="hero-h">
      <div className="hero-copy">
        <p className="eyebrow">Student marketplace</p>
        <h1 id="hero-h" className="display">Pass it on.<br /><em>Pay less.</em></h1>
        <p className="lede">Buy, rent or grab free stuff from students nearby.</p>
        <form className="searchbar glass" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
          <Search />
          <input type="search" placeholder="Try “induction cooktop”" aria-label="Search listings" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary">Search</button>
        </form>
        <div className="chips-row" role="group" aria-label="Quick categories">
          {['books', 'cycles', 'hostel', 'electronics', 'furniture'].map((k) => (
            <button key={k} className={category === k ? 'on' : ''} aria-pressed={category === k} onClick={() => { setCategory(category === k ? '' : k); onSubmit() }}>{CATEGORIES[k].split(' ')[0]}</button>
          ))}
        </div>
      </div>
      <div className="collage" aria-hidden={featured.length === 0}>
        <div className="blob" />
        {featured.slice(0, 3).map((l, i) => <Floating key={l.id} l={l} slot={SLOTS[i]} i={i} />)}
      </div>
    </section>
  )
}
