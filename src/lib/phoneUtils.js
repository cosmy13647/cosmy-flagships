import { BUSINESS } from '../data/business'

export const CONDITIONS = { new: 'Brand new', ex_uk: 'Ex-UK', used: 'Used' }
export const STATUSES = { available: 'Available', sold: 'Sold', unavailable: 'Unavailable' }
export const SOURCES = { own: 'Own stock', supplier: 'Supplier stock' }

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const MAX_IMAGES = 6

export function formatKsh(amount) {
  return `KSh ${Number(amount).toLocaleString('en-US')}`
}

export function fullName(phone) {
  return `${phone.brand} ${phone.model}`
}

// "256GB · 8GB RAM" — RAM and storage are only shown when recorded.
export function specsLine(phone) {
  const parts = []
  if (phone.storage_gb) parts.push(`${phone.storage_gb}GB`)
  if (phone.ram_gb) parts.push(`${phone.ram_gb}GB RAM`)
  return parts.join(' · ')
}

// What we may honestly tell a customer about availability, from stored data only.
export function availabilityNote(phone) {
  if (phone.status !== 'available') return null
  if (phone.stock_source === 'own') return { tone: 'ok', text: 'Own stock – available' }
  if (phone.supplier_confirmed) {
    const when = phone.supplier_confirmed_at
      ? new Date(phone.supplier_confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null
    return { tone: 'ok', text: `Supplier availability confirmed${when ? ` on ${when}` : ''}` }
  }
  return { tone: 'pending', text: 'Supplier stock – we confirm availability when you message us' }
}

// Click-to-chat link with a pre-filled message about one phone.
export function orderUrl(phone) {
  const specs = [phone.storage_gb && `${phone.storage_gb}GB`, phone.ram_gb && `${phone.ram_gb}GB RAM`, CONDITIONS[phone.condition]]
    .filter(Boolean)
    .join(', ')
  const text =
    `Hi ${BUSINESS.name}! I'm interested in the ${fullName(phone)}, ${specs}, ` +
    `listed at ${formatKsh(phone.price_kes)}. ` +
    `Is it available? Please confirm the condition and final price.`
  return `https://wa.me/${BUSINESS.whatsappInternational}?text=${encodeURIComponent(text)}`
}

export function contactUrl() {
  const text = `Hi ${BUSINESS.name}! I'd like to ask about your phones.`
  return `https://wa.me/${BUSINESS.whatsappInternational}?text=${encodeURIComponent(text)}`
}
