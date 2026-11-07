import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Bell, Chat, Grid, Heart, Plus, User } from './Icons'
import { demoMode } from '../lib/supabase'
import { Footer } from './Landing'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const loc = useLocation()
  const conversationRoute = /^\/inbox\/[^/]+\/?$/.test(loc.pathname)
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let live = true, revision = 0
    const load = () => {
      const request = ++revision
      return supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
        .then(({ count, error }) => { if (live && request === revision && !error && count !== null) setUnread(count) })
    }
    const visible = () => { if (!document.hidden) window.dispatchEvent(new Event('notices-changed')) }
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    void load()
    window.addEventListener('notices-changed', load)
    const t = setInterval(load, 60000)
    // New notifications arrive live; the interval above is only a safety net.
    const channel = profile ? supabase.channel(`notices-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
        window.dispatchEvent(new Event('notices-changed'))
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') visible() }) : undefined
    return () => {
      live = false; ++revision
      window.removeEventListener('focus', visible)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('notices-changed', load)
      clearInterval(t)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!conversationRoute) return
    const viewport = window.visualViewport
    const update = () => {
      document.documentElement.style.setProperty('--chat-height', `${viewport?.height ?? window.innerHeight}px`)
      document.documentElement.style.setProperty('--chat-top', `${viewport?.offsetTop ?? 0}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--chat-height'); document.documentElement.style.removeProperty('--chat-top')
    }
  }, [conversationRoute])
  useEffect(() => {
    document.title = unread ? `(${unread}) The Smugglr` : 'The Smugglr'
  }, [unread])
  return (
    <div className={conversationRoute ? 'app-shell conversation-shell' : 'app-shell'}>
      {demoMode && <aside role="status" style={{ padding: '8px 20px', background: '#fff2b8', color: '#292318', textAlign: 'center' }}>Demo preview · Fictional students and items · Actions are not saved</aside>}
      <header className="top">
        <NavLink to="/" className="brand">
          <span className="wordmark">The Smugglr<i>.</i></span>
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
      {!conversationRoute && <Footer />}
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end><Grid />Browse</NavLink>
        <NavLink to="/saved"><Heart />Saved</NavLink>
        <NavLink to="/sell" className="sell"><Plus />Sell</NavLink>
        <NavLink to="/inbox"><Chat />Inbox</NavLink>
        <NavLink to="/profile"><User />Profile</NavLink>
      </nav>
    </div>
  )
}
