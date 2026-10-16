// Seeds a demo project with a realistic version history: import, edits,
// a delete, a rollback-style change, across dev/staging/prod.
// Drives the same commit_version RPC the API routes use. The routes need a
// signed-in browser session, so a script cannot go through them; the RPC is
// the single production mutation path, so the seeded data is identical to
// UI-written data. Never prints values.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_USER_EMAIL=...
//        node scripts/seed-demo.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_USER_EMAIL
if (!url || !serviceKey || !email) {
  console.error('set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SEED_USER_EMAIL first')
  process.exit(1)
}

const svc = createClient(url, serviceKey, { auth: { persistSession: false } })

// actor fields need a real auth user: sign in via magic link once first
const { data: { users }, error: listErr } = await svc.auth.admin.listUsers()
if (listErr) throw listErr
const user = users.find((u) => u.email === email)
if (!user) {
  console.error(`no auth user for ${email}: sign in via magic link first`)
  process.exit(1)
}

const { data: projectId, error: createErr } = await svc.rpc('create_project', {
  p_name: 'demo-shop',
  p_owner_id: user.id,
  p_owner_email: email,
})
if (createErr) throw createErr

const set = (key, value) => ({ key, value, deleted: false })
const del = (key) => ({ key, value: null, deleted: true })

async function commit(env, message, kind, changes) {
  const { data, error } = await svc.rpc('commit_version', {
    p_project_id: projectId,
    p_env_name: env,
    p_actor_id: user.id,
    p_actor_email: email,
    p_message: message,
    p_kind: kind,
    p_changes: changes,
  })
  if (error) throw error
  return data
}

// dev: the full story, five versions
await commit('dev', 'Import .env (6 keys)', 'import', [
  set('DATABASE_URL', 'postgres://demo:demo@db.example.com:5432/shop'),
  set('REDIS_URL', 'redis://cache.example.com:6379'),
  set('STRIPE_KEY', 'sk_test_demo_51H7x'),
  set('API_TIMEOUT_MS', '5000'),
  set('FEATURE_CHECKOUT_V2', 'false'),
  set('OLD_TOKEN', 'tok_legacy_001'),
])
await commit('dev', 'Update DATABASE_URL', 'change', [
  set('DATABASE_URL', 'postgres://demo:demo@db-v2.example.com:5432/shop'),
])
await commit('dev', 'Add FEATURE_CHECKOUT_V2', 'change', [
  set('FEATURE_CHECKOUT_V2', 'true'),
])
await commit('dev', 'Delete OLD_TOKEN', 'change', [del('OLD_TOKEN')])
// rollback-style change: restore the old database host as a new version
await commit('dev', 'Restore DATABASE_URL from v2', 'change', [
  set('DATABASE_URL', 'postgres://demo:demo@db.example.com:5432/shop'),
])

// staging: quieter, two versions
await commit('staging', 'Import .env (4 keys)', 'import', [
  set('DATABASE_URL', 'postgres://demo:demo@staging-db.example.com:5432/shop'),
  set('REDIS_URL', 'redis://staging-cache.example.com:6379'),
  set('STRIPE_KEY', 'sk_test_demo_staging_9Q2z'),
  set('API_TIMEOUT_MS', '5000'),
])
await commit('staging', 'Update API_TIMEOUT_MS', 'change', [
  set('API_TIMEOUT_MS', '10000'),
])

// prod: one version, untouched since
await commit('prod', 'Import .env (5 keys)', 'import', [
  set('DATABASE_URL', 'postgres://demo:demo@prod-db.example.com:5432/shop'),
  set('REDIS_URL', 'redis://prod-cache.example.com:6379'),
  set('STRIPE_KEY', 'sk_live_demo_4T8w'),
  set('API_TIMEOUT_MS', '10000'),
  set('FEATURE_CHECKOUT_V2', 'true'),
])

// counts and keys only: values never touch the console
const { data: versions } = await svc
  .from('versions')
  .select('environment_id, seq')
  .eq('project_id', projectId)
console.log(`seeded demo-shop ${projectId}: ${(versions ?? []).length} versions`)
