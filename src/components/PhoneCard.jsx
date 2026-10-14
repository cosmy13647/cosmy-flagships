import { useState } from 'react'
import { orderUrl, formatKsh, fullName, specsLine, availabilityNote, CONDITIONS } from '../lib/phoneUtils'

function Placeholder() {
  return (
    <svg className="card__placeholder" viewBox="0 0 64 96" role="img" aria-label="Phone image not available">
      <rect x="8" y="4" width="48" height="88" rx="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="14" y="14" width="36" height="62" rx="3" fill="currentColor" opacity="0.12" />
      <circle cx="32" cy="84" r="2.5" fill="currentColor" />
    </svg>
  )
}

export default function PhoneCard({ phone }) {
  const images = phone.image_urls || []
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState({})
  const name = fullName(phone)
  const src = images[index]
  const showImage = src && !failed[src]
  const note = availabilityNote(phone)
  const specs = specsLine(phone)

  return (
    <article className="card">
      <div className="card__media">
        {showImage ? (
          <img
            src={src}
            alt={`${name}${specs ? `, ${specs}` : ''}`}
            loading="lazy"
            decoding="async"
            width="400"
            height="300"
            onError={() => setFailed((f) => ({ ...f, [src]: true }))}
          />
        ) : (
          <Placeholder />
        )}
      </div>

      {images.length > 1 && (
        <div className="card__thumbs" role="group" aria-label={`${name} photos`}>
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`thumb${i === index ? ' thumb--active' : ''}`}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {failed[url] ? null : <img src={url} alt="" loading="lazy" onError={() => setFailed((f) => ({ ...f, [url]: true }))} />}
            </button>
          ))}
        </div>
      )}

      <div className="card__body">
        <p className="card__brand">{phone.brand}</p>
        <h3 className="card__title">{phone.model}</h3>

        <ul className="card__meta">
          {specs && <li>{specs}</li>}
          <li>{CONDITIONS[phone.condition]}</li>
          {note && <li className={`avail avail--${note.tone}`}>{note.text}</li>}
        </ul>

        {phone.description && (
          <details className="card__details">
            <summary>Details</summary>
            <p>{phone.description}</p>
          </details>
        )}

        <p className="card__price">{formatKsh(phone.price_kes)}</p>

        <a
          className="btn btn--whatsapp btn--block"
          href={orderUrl(phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Order ${name} ${specs} on WhatsApp`}
        >
          Order on WhatsApp
        </a>
      </div>
    </article>
  )
}
