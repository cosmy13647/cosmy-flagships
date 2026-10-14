import { useEffect, useState } from 'react'
import { getSession, onAuthChange, checkIsAdmin, signOut } from '../services/auth'
import Login from './Login'
import Dashboard from './Dashboard'
import './admin.css'

// Gate: loading -> login -> (verify admin) -> dashboard.
// The dashboard is only a convenience; every read/write is re-checked by the
// database (row-level security), so skipping this gate gains an attacker nothing.
export default function AdminApp() {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [access, setAccess] = useState('checking') // checking | admin | denied | error

  useEffect(() => {
    let active = true
    getSession().then((s) => active && setSession(s))
    const stop = onAuthChange((s) => active && setSession(s))
    return () => {
      active = false
      stop()
    }
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    setAccess('checking')
    checkIsAdmin(userId)
      .then((ok) => active && setAccess(ok ? 'admin' : 'denied'))
      .catch(() => active && setAccess('error'))
    return () => {
      active = false
    }
  }, [userId])

  if (session === undefined) return <p className="status-msg admin-center" role="status">Loading…</p>
  if (!session) return <Login />
  if (access === 'checking') return <p className="status-msg admin-center" role="status">Checking access…</p>
  if (access !== 'admin') {
    return (
      <div className="admin-login">
        <div className="admin-card" role="alert">
          <h1>{access === 'denied' ? 'Not authorised' : 'Something went wrong'}</h1>
          <p>
            {access === 'denied'
              ? 'This account is not an administrator for Cosmy Flagships.'
              : 'We could not verify administrator access. Please try again.'}
          </p>
          <button type="button" className="btn btn--outline" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }
  return <Dashboard email={session.user.email} onSignOut={signOut} />
}
