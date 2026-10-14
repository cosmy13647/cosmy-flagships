import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAllPhones, createPhone, updatePhone, deletePhone, removeUploadedImages } from '../services/phones'
import { formatKsh, specsLine, CONDITIONS, STATUSES, SOURCES } from '../lib/phoneUtils'
import PhoneForm from './PhoneForm'
import ConfirmDialog from './ConfirmDialog'

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <p className="stat__value">{value}</p>
      <p className="stat__label">{label}</p>
      {note && <p className="stat__note">{note}</p>}
    </div>
  )
}

export default function Dashboard({ email, onSignOut }) {
  const [phones, setPhones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState(null) // { type, text }
  const [view, setView] = useState({ name: 'list' }) // list | form (phone?)
  const [busyId, setBusyId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setPhones(await listAllPhones())
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const notify = (type, text) => setMessage({ type, text })
  const replace = (row) => setPhones((list) => list.map((p) => (p.id === row.id ? row : p)))

  const stats = useMemo(() => {
    const supplier = phones.filter((p) => p.stock_source === 'supplier')
    return {
      total: phones.length,
      available: phones.filter((p) => p.status === 'available').length,
      sold: phones.filter((p) => p.status === 'sold').length,
      supplier: supplier.length,
      unconfirmed: supplier.filter((p) => p.status === 'available' && !p.supplier_confirmed).length,
    }
  }, [phones])

  const brands = useMemo(() => [...new Set(phones.map((p) => p.brand))].sort(), [phones])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return phones.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (sourceFilter !== 'all' && p.stock_source !== sourceFilter) return false
      if (brandFilter !== 'all' && p.brand !== brandFilter) return false
      return !q || `${p.brand} ${p.model}`.toLowerCase().includes(q)
    })
  }, [phones, query, statusFilter, sourceFilter, brandFilter])

  async function act(phone, fields, successText) {
    setBusyId(phone.id)
    setMessage(null)
    try {
      replace(await updatePhone(phone.id, fields))
      notify('success', successText)
    } catch (e) {
      notify('error', e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function save(payload) {
    const editing = view.phone
    if (editing) {
      replace(await updatePhone(editing.id, payload))
      notify('success', 'Changes saved.')
    } else {
      const row = await createPhone(payload)
      setPhones((list) => [row, ...list])
      notify('success', 'Phone added.')
    }
    setView({ name: 'list' })
  }

  async function confirmDelete() {
    const phone = toDelete
    setBusyId(phone.id)
    try {
      await deletePhone(phone.id)
      setPhones((list) => list.filter((p) => p.id !== phone.id))
      await removeUploadedImages(phone.image_urls || [])
      notify('success', `Deleted ${phone.brand} ${phone.model}.`)
      setToDelete(null)
    } catch (e) {
      notify('error', e.message)
      setToDelete(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="container admin-bar__inner">
          <strong>Cosmy Flagships · Admin</strong>
          <span className="admin-bar__right">
            <span className="muted small">{email}</span>
            <a href="/" className="link-btn">View shop</a>
            <button type="button" className="link-btn" onClick={onSignOut}>Sign out</button>
          </span>
        </div>
      </header>

      <main className="container admin-main">
        {message && (
          <p className={`msg msg--${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
            {message.text}
            <button type="button" className="link-btn" onClick={() => setMessage(null)} aria-label="Dismiss message">Dismiss</button>
          </p>
        )}

        {view.name === 'form' ? (
          <PhoneForm phone={view.phone} onSave={save} onCancel={() => setView({ name: 'list' })} />
        ) : (
          <>
            {!loading && !loadError && (
            <section aria-label="Overview" className="stats">
              <Stat label="Total phones" value={stats.total} />
              <Stat label="Available" value={stats.available} />
              <Stat label="Sold" value={stats.sold} />
              <Stat label="Supplier-listed" value={stats.supplier} note={stats.unconfirmed ? `${stats.unconfirmed} live, awaiting confirmation` : undefined} />
            </section>
            )}

            <div className="admin-toolbar">
              <h1>Phones</h1>
              <button type="button" className="btn btn--primary" onClick={() => { setMessage(null); setView({ name: 'form' }) }}>+ Add phone</button>
            </div>

            <div className="admin-filters">
              <div className="field">
                <label htmlFor="q" className="visually-hidden">Search</label>
                <input id="q" type="search" placeholder="Search brand or model" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Filter by stock source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="all">All sources</option>
                {Object.entries(SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Filter by brand" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                <option value="all">All brands</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {loading && <p className="status-msg" role="status">Loading phones…</p>}
            {loadError && (
              <div className="empty" role="alert">
                <p>{loadError}</p>
                <button type="button" className="btn btn--outline" onClick={load}>Try again</button>
              </div>
            )}

            {!loading && !loadError && rows.length === 0 && (
              <div className="empty">
                <h3>{phones.length === 0 ? 'No phones yet' : 'No phones match these filters'}</h3>
                <p>{phones.length === 0 ? 'Click “Add phone” to list your first one.' : 'Try clearing the search or filters.'}</p>
              </div>
            )}

            {rows.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Phone</th>
                      <th scope="col">Price</th>
                      <th scope="col">Status</th>
                      <th scope="col">Source</th>
                      <th scope="col">Updated</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const busy = busyId === p.id
                      return (
                        <tr key={p.id}>
                          <td data-label="Phone">
                            <strong>{p.brand} {p.model}</strong>
                            <div className="muted small">{[specsLine(p), CONDITIONS[p.condition]].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td data-label="Price">{formatKsh(p.price_kes)}</td>
                          <td data-label="Status"><span className={`badge badge--${p.status}`}>{STATUSES[p.status]}</span></td>
                          <td data-label="Source">
                            {SOURCES[p.stock_source]}
                            {p.stock_source === 'supplier' && (
                              <div className={`small ${p.supplier_confirmed ? 'ok' : 'warn'}`}>
                                {p.supplier_confirmed ? 'Confirmed' : 'Not confirmed'}
                              </div>
                            )}
                          </td>
                          <td data-label="Updated" className="small">{new Date(p.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                          <td data-label="Actions" className="actions">
                            <button type="button" className="link-btn" disabled={busy} onClick={() => { setMessage(null); setView({ name: 'form', phone: p }) }}>Edit</button>
                            {p.stock_source === 'supplier' && p.status === 'available' && !p.supplier_confirmed && (
                              <button type="button" className="link-btn" disabled={busy} onClick={() => act(p, { supplier_confirmed: true }, 'Supplier availability confirmed.')}>Confirm supplier</button>
                            )}
                            {p.status !== 'sold' && (
                              <button type="button" className="link-btn" disabled={busy} onClick={() => act(p, { status: 'sold' }, 'Marked as sold.')}>Mark sold</button>
                            )}
                            {p.status !== 'available' && (
                              <button type="button" className="link-btn" disabled={busy} onClick={() => act(p, { status: 'available' }, p.stock_source === 'supplier' ? 'Marked available. Confirm with the supplier before customers are told it is confirmed.' : 'Marked as available.')}>Mark available</button>
                            )}
                            {p.status === 'available' && p.stock_source === 'supplier' && (
                              <button type="button" className="link-btn" disabled={busy} onClick={() => act(p, { status: 'unavailable' }, 'Marked unavailable (hidden from customers).')}>Supplier out of stock</button>
                            )}
                            <button type="button" className="link-btn link-btn--danger" disabled={busy} onClick={() => setToDelete(p)}>Delete</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {toDelete && (
        <ConfirmDialog
          title="Delete this phone?"
          confirmLabel="Delete permanently"
          busy={busyId === toDelete.id}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p><strong>{toDelete.brand} {toDelete.model}</strong> will be permanently removed. This cannot be undone. If it was simply sold, use “Mark sold” instead.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
