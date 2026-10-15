import { lazy, Suspense } from 'react'
import Storefront from './pages/Storefront'
import { isConfigured } from './lib/supabase'
import './App.css'
import { Analytics } from "@vercel/analytics/next"
// The admin area is a separate chunk so customers never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'))

function NotConfigured() {
  return (
    <div className="container section">
      <div className="empty" role="alert">
        <h2>Backend not configured</h2>
        <p>
          Copy <code>.env.example</code> to <code>.env</code>, fill in your Supabase URL and anon key, then restart
          the dev server. See README.md.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '').startsWith('/admin')
  if (!isConfigured) return <NotConfigured />
  if (isAdminRoute) {
    return (
      <Suspense fallback={<p className="status-msg" role="status">Loading…</p>}>
        <AdminApp />
        <Analytics />
      </Suspense>
      
    )
  }
  return <Storefront />
}
