import { Link } from 'react-router-dom'
import Reveal from './Reveal'

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const STEPS = [
  { n: '01', title: 'Snap it', body: 'Add a few photos, a fair price and where on campus you can meet. Two minutes, tops.',
    art: <svg viewBox="0 0 120 90" {...line}><rect x="14" y="22" width="92" height="58" rx="10" /><circle cx="60" cy="51" r="16" /><path d="M42 22l6-10h24l6 10" /><circle cx="94" cy="34" r="2" /></svg> },
  { n: '02', title: 'Talk it through', body: 'Chat inside the site, make an offer, or ask for one more photo. No phone numbers needed.',
    art: <svg viewBox="0 0 120 90" {...line}><path d="M12 14h58v34H34l-14 12V48h-8z" /><path d="M58 58h26l14 12V58h10V30H78" /><path d="M24 26h34M24 36h20" /></svg> },
  { n: '03', title: 'Hand it over', body: 'Meet at the library, the mess or the hostel lobby, then mark it sold. Done.',
    art: <svg viewBox="0 0 120 90" {...line}><circle cx="44" cy="45" r="26" /><circle cx="76" cy="45" r="26" /><path d="M52 46l6 6 12-14" /></svg> },
]

export function HowItWorks() {
  return (
    <section className="block" aria-labelledby="how">
      <Reveal><p className="eyebrow">How it works</p><h2 id="how" className="display">Three small steps, one less thing in the bin.</h2></Reveal>
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
  { title: 'Real students only', body: 'Sign-in needs an institute account, and an admin confirms you are a current student before you can browse or list.' },
  { title: 'Chat stays private', body: 'Conversations are accessible to participants and authorized moderators. Your institute email is not public, and you do not need to share a phone number.' },
  { title: 'You are in control', body: 'Report a listing or message, block anyone, and meet in busy campus spots. Reports are available to admins for review.' },
]
export function Trust() {
  return (
    <section className="block" aria-labelledby="trust">
      <Reveal><p className="eyebrow">Trust and safety</p><h2 id="trust" className="display">Built for a campus where everyone knows someone.</h2></Reveal>
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
      <p>Someone down the corridor is looking for exactly that. List it before your next semester break.</p>
      <Link to="/sell" className="btn cta-btn">List your first item</Link>
    </Reveal>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <div><strong className="wordmark">The Smugglr</strong><p>A student-run noticeboard for passing things on. Not affiliated with any college or institute.</p></div>
      <nav aria-label="Footer"><Link to="/">Browse</Link><Link to="/wanted">Looking for</Link><Link to="/bundles">Bundles</Link><Link to="/sell">Sell</Link><Link to="/install">Install app</Link><a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy</a><a href={`${import.meta.env.BASE_URL}terms.html`}>Terms</a></nav>
    </footer>
  )
}
