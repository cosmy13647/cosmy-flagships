import { supabase, IMAGE_BUCKET } from '../lib/supabase'
import { IMAGE_TYPES, IMAGE_MAX_BYTES } from '../lib/phoneUtils'

// Turn a Supabase/Postgres error into something an admin can act on.
function explain(error) {
  if (!error) return null
  if (error.code === '42501') return 'Not allowed. Your account is not an administrator, or your session expired — sign in again.'
  if (error.code === '23514') return 'The database rejected a value (check price, storage, RAM, condition, image links and description length).'
  return error.message || 'Something went wrong. Please try again.'
}

function unwrap({ data, error }) {
  if (error) throw new Error(explain(error))
  return data
}

// ---- public storefront (RLS returns only status = 'available') -------------
export async function listAvailablePhones() {
  return unwrap(
    await supabase.from('phones').select('*').eq('status', 'available').order('created_at', { ascending: false }),
  )
}

// ---- admin (RLS returns everything only to administrators) -----------------
export async function listAllPhones() {
  return unwrap(await supabase.from('phones').select('*').order('created_at', { ascending: false }))
}

export async function createPhone(fields) {
  return unwrap(await supabase.from('phones').insert(fields).select().single())
}

export async function updatePhone(id, fields) {
  const rows = unwrap(await supabase.from('phones').update(fields).eq('id', id).select())
  if (!rows || rows.length === 0) throw new Error('Nothing was updated. The phone may have been deleted, or you are not allowed to edit it.')
  return rows[0]
}

export async function deletePhone(id) {
  const rows = unwrap(await supabase.from('phones').delete().eq('id', id).select())
  if (!rows || rows.length === 0) throw new Error('Nothing was deleted. It may already be gone, or you are not allowed to delete it.')
  return rows[0]
}

// ---- images ----------------------------------------------------------------
export async function uploadImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Only JPEG, PNG or WebP images are allowed.')
  if (file.size > IMAGE_MAX_BYTES) throw new Error('Image is too large (max 2 MB).')
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(`Image upload failed: ${explain(error)}`)
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

// Best effort: remove files we uploaded that are no longer referenced.
export async function removeUploadedImages(urls) {
  const marker = `/${IMAGE_BUCKET}/`
  const paths = urls.filter((u) => u.includes(marker)).map((u) => decodeURIComponent(u.split(marker).pop().split('?')[0]))
  if (paths.length === 0) return
  try {
    await supabase.storage.from(IMAGE_BUCKET).remove(paths)
  } catch {
    /* orphaned files are harmless; ignore */
  }
}
