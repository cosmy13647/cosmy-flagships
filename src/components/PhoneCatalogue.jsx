import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAvailablePhones } from '../services/phones'
import { CONDITIONS } from '../lib/phoneUtils'
import PhoneCard from './PhoneCard'

const BRAND_FILTERS = ['All', 'Samsung', 'Apple', 'Other']

function matchesBrand(phone, filter) {
  if (filter === 'All') return true
  if (filter === 'Other') return phone.brand.toLowerCase() !== 'samsung' && phone.brand.toLowerCase() !== 'apple'
  return phone.brand.toLowerCase() === filter.toLowerCase()
}

export default function PhoneCatalogue() {
  const [phones, setPhones] = useState([])
  const [state, setState] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('All')
  const [condition, setCondition] = useState('all')
  const [storage, setStorage] = useState('all')

  const load = useCallback(async () => {
    setState('loading')
    try {
      setPhones(await listAvailablePhones())
      setState('ready')
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const storageOptions = useMemo(
    () => [...new Set(phones.map((p) => p.storage_gb).filter(Boolean))].sort((a, b) => a - b),
    [phones],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return phones.filter((p) => {
      if (!matchesBrand(p, brand)) return false
      if (condition !== 'all' && p.condition !== condition) return false
      if (storage !== 'all' && String(p.storage_gb) !== storage) return false
      return !q || `${p.brand} ${p.model}`.toLowerCase().includes(q)
    })
  }, [phones, query, brand, condition, storage])

  function reset() {
    setQuery('')
    setBrand('All')
    setCondition('all')
    setStorage('all')
  }

  return (
    <section id="phones" className="section container" aria-labelledby="catalogue-heading">
      <h2 id="catalogue-heading" className="section__title">Phones</h2>

      <div className="toolbar">
        <div className="search">
          <label htmlFor="phone-search" className="visually-hidden">Search phones by brand or model</label>
          <input
            id="phone-search"
            type="search"
            placeholder="Search by brand or model, e.g. Galaxy"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="filters" role="group" aria-label="Filter by brand">
          {BRAND_FILTERS.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip${brand === name ? ' chip--active' : ''}`}
              aria-pressed={brand === name}
              onClick={() => setBrand(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="selects">
        <label>
          <span className="visually-hidden">Condition</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Filter by condition">
            <option value="all">Any condition</option>
            {Object.entries(CONDITIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Storage</span>
          <select value={storage} onChange={(e) => setStorage(e.target.value)} aria-label="Filter by storage">
            <option value="all">Any storage</option>
            {storageOptions.map((gb) => (
              <option key={gb} value={String(gb)}>{gb}GB</option>
            ))}
          </select>
        </label>
      </div>

      {state === 'loading' && <p className="status-msg" role="status">Loading phones…</p>}

      {state === 'error' && (
        <div className="empty" role="alert">
          <h3>Couldn't load the phones</h3>
          <p>{error}</p>
          <button type="button" className="btn btn--outline" onClick={load}>Try again</button>
        </div>
      )}

      {state === 'ready' && (
        <>
          <p className="results-count" aria-live="polite">
            {results.length} {results.length === 1 ? 'phone' : 'phones'} shown
          </p>
          {results.length > 0 ? (
            <div className="grid">
              {results.map((phone) => <PhoneCard key={phone.id} phone={phone} />)}
            </div>
          ) : phones.length === 0 ? (
            <div className="empty">
              <h3>No phones listed right now</h3>
              <p>New stock is added regularly. Message us on WhatsApp and we'll try to source what you want.</p>
            </div>
          ) : (
            <div className="empty">
              <h3>No phones match your search</h3>
              <p>Try a different brand or model. Looking for something specific? Message us on WhatsApp and we'll try to source it.</p>
              <button type="button" className="btn btn--outline" onClick={reset}>Clear search and filters</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
