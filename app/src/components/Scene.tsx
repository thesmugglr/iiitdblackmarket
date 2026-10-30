import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, inr } from '../lib/constants'
import type { Listing } from '../lib/types'

const SLOT = 270
const H = 400
const GROUND = 318
const STALLS: { key: string; awning: [string, string] }[] = [
  { key: 'books', awning: ['#ff6b8b', '#ffe3ea'] },
  { key: 'cycles', awning: ['#4fe3c1', '#d9fbf2'] },
  { key: 'hostel', awning: ['#ffc247', '#fff0c9'] },
  { key: 'furniture', awning: ['#8f7bff', '#e6e1ff'] },
  { key: 'electronics', awning: ['#4aa8ff', '#d8ecff'] },
  { key: 'clothing', awning: ['#ff8f4a', '#ffe5d3'] },
  { key: 'sports', awning: ['#a6e04a', '#eefad2'] },
  { key: 'misc', awning: ['#ff6b8b', '#4fe3c1'] },
]
const W = STALLS.length * SLOT + 260

function Prop({ k }: { k: string }) {
  const s = { fill: 'none', stroke: '#0d1128', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  switch (k) {
    case 'books': return <g {...s}><rect x="-26" y="-10" width="52" height="9" fill="#ffe3ea"/><rect x="-22" y="-19" width="44" height="9" fill="#ff6b8b"/><rect x="-18" y="-28" width="36" height="9" fill="#ffc247"/></g>
    case 'cycles': return <g {...s}><circle cx="-18" cy="-12" r="11"/><circle cx="18" cy="-12" r="11"/><path d="M-18 -12L-4 -26h14l8 14M-4 -26l6 14"/></g>
    case 'hostel': return <g {...s}><path d="M-12 -4h24M0 -4v-18M-14 -22l14-10 14 10z" fill="#ffc247"/></g>
    case 'furniture': return <g {...s}><path d="M-16 -28v26M16 -2v-26M-16 -14h32M-16 -28h32" /></g>
    case 'electronics': return <g {...s}><rect x="-24" y="-34" width="48" height="30" fill="#d8ecff"/><path d="M-10 -4h20"/></g>
    case 'clothing': return <g {...s}><path d="M0 -34v6M-22 -8l22-20 22 20z" fill="#ffe5d3"/></g>
    case 'sports': return <g {...s}><circle cx="0" cy="-18" r="16" fill="#eefad2"/><path d="M-16 -18h32M0 -34v32"/></g>
    default: return <g {...s}><rect x="-22" y="-28" width="44" height="26" fill="#ffe3ea"/><path d="M-22 -18h44"/></g>
  }
}

function Stall({ i, k, awning, count, on, active, onPick }: { i: number; k: string; awning: [string, string]; count: number; on: boolean; active: boolean; onPick: () => void }) {
  const x = 130 + i * SLOT + 20
  const stripes = Array.from({ length: 6 }, (_, n) => n)
  return (
    <g transform={`translate(${x},0)`} className={`stall ${on ? 'lit' : ''} ${active ? 'sel' : ''}`} tabIndex={0} role="button" aria-label={`${CATEGORIES[k]}, ${count} listings`} aria-pressed={on}
      onClick={onPick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}>
      <ellipse cx="0" cy={GROUND + 4} rx="112" ry="9" fill="#05071a" opacity=".5" />
      <circle className="halo" cx="0" cy="190" r="118" fill="#ffc247" />
      <rect x="-96" y="230" width="192" height={GROUND - 230} fill="#2a2147" stroke="#0d1128" strokeWidth="3" />
      <rect x="-104" y="222" width="208" height="14" fill="#3b2f63" stroke="#0d1128" strokeWidth="3" />
      <rect x="-100" y="140" width="6" height="88" fill="#0d1128" /><rect x="94" y="140" width="6" height="88" fill="#0d1128" />
      <g transform="translate(0,222)"><Prop k={k} /></g>
      <g className="awning">
        {stripes.map((n) => (
          <path key={n} d={`M${-108 + n * 36} 140h36v34a18 18 0 0 1-36 0z`} fill={awning[n % 2]} stroke="#0d1128" strokeWidth="3" />
        ))}
        <rect x="-110" y="128" width="220" height="14" fill="#0d1128" />
      </g>
      <g className="sign"><rect x="-78" y="92" width="156" height="30" fill="#0d1128" stroke={awning[0]} strokeWidth="2.5" rx="3" />
        <text x="0" y="112" textAnchor="middle" fill="#eceffc" fontSize="14" fontWeight="700" letterSpacing=".06em">{CATEGORIES[k].split(' ')[0].toUpperCase()}</text></g>
      <path d="M0 128v18" stroke="#0d1128" strokeWidth="2.5" />
      <circle className="bulb" cx="0" cy="156" r="9" fill="#ffc247" stroke="#0d1128" strokeWidth="2.5" />
      <g transform="translate(70,270)"><circle r="16" fill="#0d1128" stroke={awning[0]} strokeWidth="2.5" /><text y="5" textAnchor="middle" fill="#eceffc" fontSize="14" fontWeight="700">{count}</text></g>
    </g>
  )
}

function useStars(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.62, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }))
    const flies = Array.from({ length: 22 }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.4, a: Math.random() * 6, s: 0.2 + Math.random() * 0.5 }))
    const resize = () => {
      const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2)
      w = r.width; h = r.height; c.width = w * d; c.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t / 900 + s.p))
        ctx.fillStyle = '#eceffc'; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#f6f1d8'; ctx.beginPath(); ctx.arc(w * 0.84, h * 0.2, 26, 0, 7); ctx.fill()
      ctx.fillStyle = '#0d1128'; ctx.beginPath(); ctx.arc(w * 0.84 + 11, h * 0.2 - 5, 23, 0, 7); ctx.fill()
      for (const f of flies) {
        const x = (f.x * w + Math.sin(t / 1800 * f.s + f.a) * 40 + w) % w
        const y = f.y * h + Math.cos(t / 1400 * f.s + f.a) * 18
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 700 * f.s + f.a))
        ctx.fillStyle = '#d6ff6b'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!calm) raf = requestAnimationFrame(draw)
    }
    resize(); draw(0)
    if (!calm) raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => { resize(); if (calm) draw(0) })
    ro.observe(c)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [ref])
}

export default function Scene({ counts, category, onPick, tags }: { counts: Record<string, number>; category: string; onPick: (k: string) => void; tags: Listing[] }) {
  const box = useRef<HTMLDivElement>(null)
  const sky = useRef<HTMLCanvasElement>(null)
  const layers = useRef<(HTMLElement | null)[]>([])
  const st = useRef({ x: 0, v: 0, drag: false, lx: 0, moved: 0, vw: 1000 })
  const [hover, setHover] = useState<string | null>(null)
  const [atEnd, setAtEnd] = useState<'start' | 'end' | 'mid'>('start')
  const nav = useNavigate()
  useStars(sky)

  const apply = () => {
    const s = st.current
    const max = Math.max(0, W - s.vw)
    s.x = Math.min(max, Math.max(0, s.x))
    const f = [0.12, 0.4, 1]
    layers.current.forEach((el, i) => el && (el.style.transform = `translate3d(${-s.x * f[i]}px,0,0)`))
    setAtEnd(s.x <= 1 ? 'start' : s.x >= max - 1 ? 'end' : 'mid')
  }

  useEffect(() => {
    const el = box.current!
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s = st.current
    let raf = 0
    const measure = () => { s.vw = el.clientWidth; apply() }
    const tick = () => {
      if (!s.drag && Math.abs(s.v) > 0.1) { s.x += s.v; s.v *= calm ? 0 : 0.93; apply() }
      raf = requestAnimationFrame(tick)
    }
    measure(); raf = requestAnimationFrame(tick)
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  const down = (e: React.PointerEvent) => { const s = st.current; s.drag = true; s.lx = e.clientX; s.moved = 0; s.v = 0 }
  const move = (e: React.PointerEvent) => {
    const s = st.current
    if (!s.drag) return
    const dx = e.clientX - s.lx
    s.lx = e.clientX; s.moved += Math.abs(dx)
    if (s.moved > 4) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    s.x -= dx; s.v = -dx; apply()
  }
  const up = () => { st.current.drag = false }
  const shove = (d: number) => { st.current.v = d }
  const pick = (k: string) => { if (st.current.moved < 6) onPick(k) }

  const bulbs = useMemo(() => Array.from({ length: Math.floor(W / 90) }, (_, n) => n), [])
  const hanging = tags.slice(0, 6)

  return (
    <div className="scene" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      onWheel={(e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { st.current.x += e.deltaX; apply() } }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') shove(18); if (e.key === 'ArrowLeft') shove(-18) }}>
      <canvas ref={sky} className="sky" aria-hidden="true" />
      <div className="layer" ref={(el) => { layers.current[0] = el }} style={{ width: W }} aria-hidden="true">
        <svg width={W} height={H + 70} viewBox={`0 -70 ${W} ${H + 70}`}>
          {Array.from({ length: 14 }, (_, n) => {
            const bx = n * 190, bh = 90 + ((n * 53) % 90)
            return <g key={n}><rect x={bx} y={GROUND - bh} width={150} height={bh + 60} fill="#151a45" />
              {Array.from({ length: 6 }, (_, w) => <rect key={w} x={bx + 18 + (w % 3) * 40} y={GROUND - bh + 18 + Math.floor(w / 3) * 34} width="16" height="20" fill={(n + w) % 3 ? '#232a63' : '#ffc247'} opacity={(n + w) % 3 ? 1 : 0.8} />)}</g>
          })}
        </svg>
      </div>
      <div className="layer" ref={(el) => { layers.current[1] = el }} style={{ width: W }} aria-hidden="true">
        <svg width={W} height={H + 70} viewBox={`0 -70 ${W} ${H + 70}`}>
          {Array.from({ length: 10 }, (_, n) => <g key={n} transform={`translate(${n * 270 + 60},0)`}><rect x="-3" y="170" width="6" height={GROUND - 170} fill="#0a0d24" /><circle cx="0" cy="170" r="42" fill="#0f1536" /><circle cx="28" cy="190" r="30" fill="#0f1536" /></g>)}
        </svg>
      </div>
      <div className="layer front" ref={(el) => { layers.current[2] = el }} style={{ width: W }}>
        <svg width={W} height={H + 70} viewBox={`0 -70 ${W} ${H + 70}`}>
          <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="#080b1f" />
          <path d={`M0 ${GROUND}H${W}`} stroke="#2a3166" strokeWidth="3" />
          <path d={`M0 40 Q ${W / 2} 90 ${W} 40`} fill="none" stroke="#0d1128" strokeWidth="2.5" className="wire" />
          {bulbs.map((n) => {
            const x = 40 + n * 90, t = x / W, y = 40 + 100 * t * (1 - t)
            return <circle key={n} className="festoon" style={{ animationDelay: `${(n % 5) * 0.4}s` }} cx={x} cy={y + 6} r="6" fill={['#ffc247', '#4fe3c1', '#ff6b8b'][n % 3]} />
          })}
          {hanging.map((l, n) => {
            const x = 285 + n * 270, t = x / W, y = 40 + 100 * t * (1 - t)
            return (
              <g key={l.id} transform={`translate(${x},${y})`} className="tag" tabIndex={0} role="link" aria-label={`${l.title}, ${l.listing_type === 'giveaway' ? 'free' : inr(l.price_inr)}`}
                onClick={() => st.current.moved < 6 && nav(`/listing/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/listing/${l.id}`)}
                onPointerEnter={() => setHover(l.id)} onPointerLeave={() => setHover(null)}>
                <g className="swing">
                  <path d="M0 0v22" stroke="#0d1128" strokeWidth="2" />
                  <rect x="-50" y="22" width="100" height="44" rx="4" fill={hover === l.id ? '#ffc247' : '#eceffc'} stroke="#0d1128" strokeWidth="3" />
                  <circle cx="0" cy="22" r="4" fill="#0d1128" />
                  <text x="0" y="40" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0d1128">{l.title.length > 12 ? l.title.slice(0, 11) + '…' : l.title}</text>
                  <text x="0" y="58" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0d1128">{l.listing_type === 'giveaway' ? 'FREE' : inr(l.price_inr)}</text>
                </g>
              </g>
            )
          })}
          {STALLS.map((s, i) => <Stall key={s.key} i={i} k={s.key} awning={s.awning} count={counts[s.key] ?? 0} on={category === s.key} active={category === s.key} onPick={() => pick(s.key)} />)}
        </svg>
      </div>
      <div className="scene-title"><h1>The night market</h1><p>Drag to wander. Tap a stall to browse it.</p></div>
      <button className="nudge l" aria-label="Scroll left" disabled={atEnd === 'start'} onClick={() => shove(-26)}>‹</button>
      <button className="nudge r" aria-label="Scroll right" disabled={atEnd === 'end'} onClick={() => shove(26)}>›</button>
    </div>
  )
}
