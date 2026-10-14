import { createClient } from '@supabase/supabase-js'

// These two values are PUBLIC by design (the anon key is safe in the browser):
// what a visitor can do is limited by the database's row-level security rules
// in supabase/schema.sql. NEVER put the service_role key in this project.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const IMAGE_BUCKET = 'phone-images'
