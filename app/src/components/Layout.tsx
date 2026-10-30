import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './Icon'

export default function Layout() {
  const { profile, signOut } = useAuth()
  return (
    <>
      <header className="top">
        <NavLink to="/" className="brand" aria-label="IIITD Black Market home"><span className="app-brand-icon"><Icon name="exchange" /></span><span>blackmarket<small>IIIT DELHI / STUDENT TO STUDENT</small></span></NavLink>
        <nav className="desktop-nav">
          <NavLink to="/" end>Browse</NavLink>
          <NavLink to="/saved">Saved</NavLink>
          <NavLink to="/sell" className="cta">Sell</NavLink>
          <NavLink to="/inbox">Inbox</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          {profile?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          <button className="link" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <nav className="tabbar">
        <NavLink to="/" end><Icon name="grid" />Browse</NavLink>
        <NavLink to="/saved"><Icon name="book" />Saved</NavLink>
        <NavLink to="/sell" className="cta"><Icon name="plus" />Sell</NavLink>
        <NavLink to="/inbox"><Icon name="chat" />Inbox</NavLink>
        <NavLink to="/profile"><Icon name="shield" />Profile</NavLink>
      </nav>
    </>
  )
}
