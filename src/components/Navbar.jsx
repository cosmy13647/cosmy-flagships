import { BUSINESS } from '../data/business'
import { contactUrl } from '../lib/phoneUtils'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <a className="logo" href="/" aria-label={`${BUSINESS.name} home`}>
          <span className="logo__mark" aria-hidden="true">C</span>
          <span className="logo__text">
            Cosmy <span className="logo__accent">Flagships</span>
          </span>
        </a>
        <a className="btn btn--whatsapp btn--small" href={contactUrl()} target="_blank" rel="noopener noreferrer">
          WhatsApp us
        </a>
      </div>
    </header>
  )
}
