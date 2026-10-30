import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Bell, Chat, Grid, Heart, Plus, User } from './Icons'
import { demoMode } from '../lib/supabase'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const loc = useLocation()
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const load = () => supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then(({ count }) => setUnread(count ?? 0))
    void load()
    window.addEventListener('notices-changed', load)
    const t = setInterval(load, 60000)
    return () => { window.removeEventListener('notices-changed', load); clearInterval(t) }
  }, [loc.pathname])
  return (
    <>
      {demoMode && <aside role="status" style={{ padding: '8px 20px', background: '#fff2b8', color: '#292318', textAlign: 'center' }}>Demo preview · Fictional students and items · Actions are not saved</aside>}
      <header className="top">
        <NavLink to="/" className="brand">
          <span className="mark">B</span>
          <span>IIITD <em>Black Market</em></span>
        </NavLink>
        <NavLink to="/notifications" className="bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />{unread > 0 && <span className="badge unread">{unread}</span>}
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
