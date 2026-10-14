import { useState } from 'react'
import { uploadImage, removeUploadedImages } from '../services/phones'
import { CONDITIONS, STATUSES, SOURCES, IMAGE_TYPES, MAX_IMAGES } from '../lib/phoneUtils'

const BRAND_SUGGESTIONS = ['Samsung', 'Apple', 'Google', 'OnePlus', 'Xiaomi', 'Huawei', 'Oppo']

const EMPTY = {
  brand: '', model: '', storage_gb: '', ram_gb: '', price_kes: '', condition: 'ex_uk',
  description: '', image_urls: [], status: 'available', stock_source: 'own', supplier_confirmed: false,
}

function fromPhone(p) {
  return {
    brand: p.brand, model: p.model, storage_gb: p.storage_gb ?? '', ram_gb: p.ram_gb ?? '', price_kes: p.price_kes,
    condition: p.condition, description: p.description || '', image_urls: p.image_urls || [],
    status: p.status, stock_source: p.stock_source, supplier_confirmed: p.supplier_confirmed,
  }
}

const isHttps = (u) => /^https:\/\/\S+$/i.test(u)

// Client-side checks are for convenience; the database enforces the same rules.
export function validate(f) {
  const errors = {}
  if (!f.brand.trim()) errors.brand = 'Brand is required.'
  if (!f.model.trim()) errors.model = 'Model is required.'
  const int = (v) => (v === '' ? null : Number(v))
  const price = int(f.price_kes)
  if (!Number.isInteger(price) || price < 1 || price > 10000000) errors.price_kes = 'Enter a whole-number price in KSh.'
  const storage = int(f.storage_gb)
  if (storage !== null && (!Number.isInteger(storage) || storage < 1 || storage > 4096)) errors.storage_gb = 'Storage must be 1–4096 GB, or left blank.'
  const ram = int(f.ram_gb)
  if (ram !== null && (!Number.isInteger(ram) || ram < 1 || ram > 64)) errors.ram_gb = 'RAM must be 1–64 GB, or left blank.'
  if (f.description.length > 2000) errors.description = 'Description is too long (max 2000 characters).'
  return errors
}

export function toPayload(f) {
  const supplier = f.stock_source === 'supplier'
  return {
    brand: f.brand.trim(),
    model: f.model.trim(),
    storage_gb: f.storage_gb === '' ? null : Number(f.storage_gb),
    ram_gb: f.ram_gb === '' ? null : Number(f.ram_gb),
    price_kes: Number(f.price_kes),
    condition: f.condition,
    description: f.description.trim(),
    image_urls: f.image_urls,
    status: f.status,
    stock_source: f.stock_source,
    supplier_confirmed: supplier && f.status === 'available' && f.supplier_confirmed,
  }
}

export default function PhoneForm({ phone, onSave, onCancel }) {
  const [f, setF] = useState(phone ? fromPhone(phone) : EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [imgMsg, setImgMsg] = useState({ type: '', text: '' })
  const [formError, setFormError] = useState('')
  const [uploaded, setUploaded] = useState([]) // files uploaded during this edit session

  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const supplier = f.stock_source === 'supplier'

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (f.image_urls.length >= MAX_IMAGES) return setImgMsg({ type: 'error', text: `Maximum ${MAX_IMAGES} images.` })
    setUploading(true)
    setImgMsg({ type: '', text: '' })
    try {
      const url = await uploadImage(file)
      setF((prev) => ({ ...prev, image_urls: [...prev.image_urls, url] }))
      setUploaded((u) => [...u, url])
      setImgMsg({ type: 'success', text: 'Image uploaded.' })
    } catch (err) {
      setImgMsg({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  function addUrl() {
    const url = urlInput.trim()
    if (!isHttps(url)) return setImgMsg({ type: 'error', text: 'Image links must start with https://' })
    if (f.image_urls.includes(url)) return setImgMsg({ type: 'error', text: 'That image is already added.' })
    if (f.image_urls.length >= MAX_IMAGES) return setImgMsg({ type: 'error', text: `Maximum ${MAX_IMAGES} images.` })
    setF((prev) => ({ ...prev, image_urls: [...prev.image_urls, url] }))
    setUrlInput('')
    setImgMsg({ type: '', text: '' })
  }

  const removeImage = (url) => setF((prev) => ({ ...prev, image_urls: prev.image_urls.filter((u) => u !== url) }))

  async function submit(e) {
    e.preventDefault()
    const v = validate(f)
    setErrors(v)
    setFormError('')
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const payload = toPayload(f)
      await onSave(payload)
      // Clean up files that were uploaded but then removed from the listing,
      // and files that belonged to the listing before and were removed now.
      const removedNow = (phone?.image_urls || []).filter((u) => !payload.image_urls.includes(u))
      const orphaned = uploaded.filter((u) => !payload.image_urls.includes(u))
      await removeUploadedImages([...removedNow, ...orphaned])
    } catch (err) {
      setFormError(err.message)
      setSaving(false)
    }
  }

  function cancel() {
    removeUploadedImages(uploaded) // discard files uploaded in this session
    onCancel()
  }

  const fieldErr = (k) => errors[k] && <span className="field__error" id={`${k}-err`}>{errors[k]}</span>
  const aria = (k) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  return (
    <form className="admin-panel" onSubmit={submit} noValidate>
      <h2>{phone ? `Edit ${phone.brand} ${phone.model}` : 'Add phone'}</h2>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="brand">Brand *</label>
          <input id="brand" list="brands" value={f.brand} onChange={set('brand')} maxLength={50} {...aria('brand')} />
          <datalist id="brands">{BRAND_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>
          {fieldErr('brand')}
        </div>
        <div className="field">
          <label htmlFor="model">Model *</label>
          <input id="model" value={f.model} onChange={set('model')} maxLength={100} placeholder="e.g. Galaxy S23" {...aria('model')} />
          {fieldErr('model')}
        </div>
        <div className="field">
          <label htmlFor="storage_gb">Storage (GB)</label>
          <input id="storage_gb" type="number" inputMode="numeric" min="1" max="4096" value={f.storage_gb} onChange={set('storage_gb')} placeholder="e.g. 256" {...aria('storage_gb')} />
          {fieldErr('storage_gb')}
        </div>
        <div className="field">
          <label htmlFor="ram_gb">RAM (GB) <span className="muted">optional</span></label>
          <input id="ram_gb" type="number" inputMode="numeric" min="1" max="64" value={f.ram_gb} onChange={set('ram_gb')} placeholder="leave blank if unknown" {...aria('ram_gb')} />
          {fieldErr('ram_gb')}
        </div>
        <div className="field">
          <label htmlFor="price_kes">Selling price (KSh) *</label>
          <input id="price_kes" type="number" inputMode="numeric" min="1" value={f.price_kes} onChange={set('price_kes')} {...aria('price_kes')} />
          {fieldErr('price_kes')}
        </div>
        <div className="field">
          <label htmlFor="condition">Condition</label>
          <select id="condition" value={f.condition} onChange={set('condition')}>
            {Object.entries(CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stock_source">Stock source</label>
          <select id="stock_source" value={f.stock_source} onChange={set('stock_source')}>
            {Object.entries(SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" value={f.status} onChange={set('status')}>
            {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="hint">Only “Available” phones are shown to customers.</span>
        </div>
      </div>

      {supplier && (
        <label className="check">
          <input type="checkbox" checked={f.supplier_confirmed && f.status === 'available'} disabled={f.status !== 'available'} onChange={set('supplier_confirmed')} />
          <span>
            Supplier has confirmed this phone is in stock
            <span className="hint"> — leave unticked until you've checked; customers are then told availability is confirmed on WhatsApp.</span>
          </span>
        </label>
      )}

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" rows="4" value={f.description} onChange={set('description')} maxLength={2000} {...aria('description')} />
        {fieldErr('description')}
      </div>

      <fieldset className="images">
        <legend>Images ({f.image_urls.length}/{MAX_IMAGES})</legend>
        {f.image_urls.length > 0 && (
          <ul className="image-list">
            {f.image_urls.map((url, i) => (
              <li key={url}>
                <img src={url} alt={`Preview ${i + 1}`} width="64" height="64" />
                <span className="image-url">{i === 0 ? 'Main image · ' : ''}{url}</span>
                <button type="button" className="link-btn" onClick={() => removeImage(url)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="image-add">
          <div className="field">
            <label htmlFor="image-file">Upload (JPEG, PNG or WebP, max 2 MB)</label>
            <input id="image-file" type="file" accept={IMAGE_TYPES.join(',')} onChange={onFile} disabled={uploading} />
          </div>
          <div className="field">
            <label htmlFor="image-url">…or paste an image link (https)</label>
            <div className="inline">
              <input id="image-url" type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…" />
              <button type="button" className="btn btn--outline btn--small" onClick={addUrl}>Add</button>
            </div>
          </div>
        </div>
        {uploading && <p className="msg" role="status">Uploading…</p>}
        {imgMsg.text && <p className={`msg msg--${imgMsg.type}`} role={imgMsg.type === 'error' ? 'alert' : 'status'}>{imgMsg.text}</p>}
      </fieldset>

      {formError && <p className="msg msg--error" role="alert">{formError}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={saving || uploading}>
          {saving ? 'Saving…' : phone ? 'Save changes' : 'Add phone'}
        </button>
        <button type="button" className="btn btn--outline" onClick={cancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
