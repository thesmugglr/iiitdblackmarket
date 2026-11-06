import { NavLink } from 'react-router-dom'

export default function Sections() {
  return (
    <nav className="sections" aria-label="Marketplace sections">
      <NavLink to="/" end>Items</NavLink>
      <NavLink to="/wanted">Looking for</NavLink>
      <NavLink to="/bundles">Bundles</NavLink>
      <NavLink to="/lost-found">Lost &amp; found</NavLink>
    </nav>
  )
}
