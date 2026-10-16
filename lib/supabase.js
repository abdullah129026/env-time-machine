// Browser-safe Supabase clients. No next/headers here: this module is
// imported by client components too. Server-only bits live in
// lib/supabase-server.js.
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function isConfigured() {
  return Boolean(url && anonKey)
}

export function serviceConfigured() {
  return Boolean(url && serviceKey)
}

export function browserClient() {
  if (!isConfigured()) return null
  return createBrowserClient(url, anonKey)
}

// Service-role client. Server only: route handlers and server components.
// Never import this module into a client component.
// ponytail: one shared client per request is enough at this scale; the
// Supabase client is a thin wrapper over fetch, no pooling needed.
export function serviceClient() {
  if (!serviceConfigured()) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
