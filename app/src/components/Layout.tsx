import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { profile, signOut } = useAuth()
  return (
    <>
      <header className="top">
        <NavLink to="/" className="brand">IIITD Black Market</NavLink>
        <nav className="desktop-nav">
          <NavLink to="/">Browse</NavLink>
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
        <NavLink to="/" end>Browse</NavLink>
        <NavLink to="/saved">Saved</NavLink>
        <NavLink to="/sell" className="cta">Sell</NavLink>
        <NavLink to="/inbox">Inbox</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
    </>
  )
}
