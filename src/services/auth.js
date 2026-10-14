import { supabase } from '../lib/supabase'

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Sign-in failed. Check your email and password.')
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// The database decides who is an admin (public.admins, row-level security).
// This only drives what the UI shows; the API refuses non-admins regardless.
export async function checkIsAdmin(userId) {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Could not verify administrator access.')
  return Boolean(data)
}
