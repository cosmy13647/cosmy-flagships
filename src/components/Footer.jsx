import { BUSINESS } from '../data/business'
import { contactUrl } from '../lib/phoneUtils'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <p className="footer__name">{BUSINESS.name}</p>
          <p className="footer__text">Ex-UK flagship smartphones in Kenya.</p>
        </div>
        <div>
          <p className="footer__text">
            WhatsApp:{' '}
            <a href={contactUrl()} target="_blank" rel="noopener noreferrer">
              {BUSINESS.whatsappDisplay}
            </a>
          </p>
          <p className="footer__text footer__note">
            Availability, condition, final price, payment and delivery are confirmed with you on
            WhatsApp.
          </p>
        </div>
      </div>
      <p className="footer__copy">
        © {new Date().getFullYear()} {BUSINESS.name}
      </p>
    </footer>
  )
}
