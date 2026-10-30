import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Chat, Grid, Heart, Plus, User } from './Icons'
import { demoMode } from '../lib/supabase'

export default function Layout() {
  const { profile, signOut } = useAuth()
  return (
    <>
      {demoMode && <aside role="status" style={{ padding: '8px 20px', background: '#fff2b8', color: '#292318', textAlign: 'center' }}>Demo preview · Fictional students and items · Actions are not saved</aside>}
      <header className="top">
        <NavLink to="/" className="brand">
          <span className="mark">B</span>
          <span>IIITD <em>Black Market</em></span>
        </NavLink>
        <nav className="desktop-nav">
          <NavLink to="/" end>Browse</NavLink>
          <NavLink to="/saved">Saved</NavLink>
          <NavLink to="/inbox">Inbox</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          {profile?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          <button className="link" onClick={signOut}>Sign out</button>
          <NavLink to="/sell" className="btn primary">Sell an item</NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end><Grid />Browse</NavLink>
        <NavLink to="/saved"><Heart />Saved</NavLink>
        <NavLink to="/sell" className="sell"><Plus />Sell</NavLink>
        <NavLink to="/inbox"><Chat />Inbox</NavLink>
        <NavLink to="/profile"><User />Profile</NavLink>
      </nav>
    </>
  )
}
