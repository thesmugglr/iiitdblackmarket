import { Link } from 'react-router-dom'
import Reveal from './Reveal'

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const STEPS = [
  { n: '01', title: 'Snap it', body: 'A few photos and a price. Two minutes.',
    art: <svg viewBox="0 0 120 90" {...line}><rect x="14" y="22" width="92" height="58" rx="10" /><circle cx="60" cy="51" r="16" /><path d="M42 22l6-10h24l6 10" /><circle cx="94" cy="34" r="2" /></svg> },
  { n: '02', title: 'Talk it through', body: 'Chat and make offers. No phone numbers.',
    art: <svg viewBox="0 0 120 90" {...line}><path d="M12 14h58v34H34l-14 12V48h-8z" /><path d="M58 58h26l14 12V58h10V30H78" /><path d="M24 26h34M24 36h20" /></svg> },
  { n: '03', title: 'Hand it over', body: 'Meet on campus, mark it sold.',
    art: <svg viewBox="0 0 120 90" {...line}><circle cx="44" cy="45" r="26" /><circle cx="76" cy="45" r="26" /><path d="M52 46l6 6 12-14" /></svg> },
]

export function HowItWorks() {
  return (
    <section className="block" aria-labelledby="how">
      <Reveal><p className="eyebrow">How it works</p><h2 id="how" className="display">Three steps.</h2></Reveal>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.n}><Reveal delay={i * 0.1}>
            <span className="num" aria-hidden="true">{s.n}</span>
            <div className="art" aria-hidden="true">{s.art}</div>
            <h3>{s.title}</h3><p>{s.body}</p>
          </Reveal></li>
        ))}
      </ol>
    </section>
  )
}

const TRUST = [
  { title: 'Real students only', body: 'Every account is checked by an admin.' },
  { title: 'Chat stays private', body: 'Your email and number stay hidden.' },
  { title: 'You are in control', body: 'Report or block anyone, anytime.' },
]
export function Trust() {
  return (
    <section className="block" aria-labelledby="trust">
      <Reveal><p className="eyebrow">Trust and safety</p><h2 id="trust" className="display">Safe by design.</h2></Reveal>
      <div className="trust">
        {TRUST.map((t, i) => (
          <Reveal key={t.title} delay={i * 0.1} className={`panel stagger-${i}`}>
            <span className="verified" aria-hidden="true">✓</span><h3>{t.title}</h3><p>{t.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function Cta() {
  return (
    <Reveal className="cta-block">
      <h2 className="display">Got a cycle gathering dust?</h2>
      <p>Someone nearby wants it.</p>
      <Link to="/sell" className="btn cta-btn">List your first item</Link>
    </Reveal>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <div><strong className="wordmark">The Smugglr</strong><p>Student-run. Not affiliated with any college.</p></div>
      <nav aria-label="Footer"><Link to="/" className="wide-only">Browse</Link><Link to="/wanted" className="wide-only">Looking for</Link><Link to="/bundles" className="wide-only">Bundles</Link><Link to="/sell" className="wide-only">Sell</Link><Link to="/install">Install app</Link><a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy</a><a href={`${import.meta.env.BASE_URL}terms.html`}>Terms</a></nav>
    </footer>
  )
}
