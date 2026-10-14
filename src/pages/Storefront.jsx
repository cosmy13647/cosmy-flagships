import Navbar from '../components/Navbar'
import PhoneCatalogue from '../components/PhoneCatalogue'
import Footer from '../components/Footer'
import { BUSINESS } from '../data/business'

export default function Storefront() {
  return (
    <div id="top">
      <Navbar />
      <main>
        <section className="hero">
          <div className="container hero__inner">
            <p className="hero__eyebrow">Ex-UK smartphones</p>
            <h1 className="hero__title">{BUSINESS.tagline}</h1>
            <p className="hero__text">
              {BUSINESS.name} offers ex-UK flagship smartphones from leading brands. Browse the catalogue, then
              message us on WhatsApp to confirm availability, condition and the final price.
            </p>
            <a className="btn btn--primary" href="#phones">Explore Phones</a>
          </div>
        </section>
        <PhoneCatalogue />
      </main>
      <Footer />
    </div>
  )
}
