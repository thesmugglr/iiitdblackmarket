import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Browse from './pages/Browse'
import ListingDetail from './pages/ListingDetail'
import Sell from './pages/Sell'
import Saved from './pages/Saved'
import Inbox from './pages/Inbox'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Notifications from './pages/Notifications'
import Wanted from './pages/Wanted'
import Bundles from './pages/Bundles'
import BundleNew from './pages/BundleNew'
import BundleDetail from './pages/BundleDetail'

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="muted center-box">Loading…</p>
  if (!session) return <Login />
  if (!profile || profile.status !== 'approved') return <Pending />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="listing/:id" element={<ListingDetail />} />
        <Route path="sell" element={<Sell />} />
        <Route path="sell/:id" element={<Sell />} />
        <Route path="saved" element={<Saved />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/:id" element={<Chat />} />
        <Route path="wanted" element={<Wanted />} />
        <Route path="bundles" element={<Bundles />} />
        <Route path="bundles/new" element={<BundleNew />} />
        <Route path="bundles/:id" element={<BundleDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={profile.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
