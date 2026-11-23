import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="foot">
      <div><strong className="wordmark">The Smugglr</strong><p>Student-run. Not affiliated with any college.</p></div>
      <nav aria-label="Footer"><Link to="/" className="wide-only">Browse</Link><Link to="/wanted" className="wide-only">Looking for</Link><Link to="/bundles" className="wide-only">Bundles</Link><Link to="/sell" className="wide-only">Sell</Link><Link to="/install">Install app</Link><a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy</a><a href={`${import.meta.env.BASE_URL}terms.html`}>Terms</a></nav>
    </footer>
  )
}
