import { json } from '@/lib/guard'
import { serviceClient, serviceConfigured } from '@/lib/supabase'
import { purgeOldData, RETENTION_DAYS } from '@/lib/retention'

// Nightly retention purge, fired by the Vercel cron in vercel.json.
// Not a user route: the only gate is the shared CRON_SECRET bearer.
// With the secret unset the route refuses to exist (503), never an
// open purge.
export async function GET(request) {
  if (!serviceConfigured()) return json({ error: 'Supabase is not configured' }, 503)

  const secret = process.env.CRON_SECRET
  if (!secret) return json({ error: 'cron not configured' }, 503)
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'unauthorized' }, 401)
  }

  try {
    const result = await purgeOldData(serviceClient())
    return json({ retention_days: RETENTION_DAYS, ...result })
  } catch {
    return json({ error: 'purge failed' }, 500)
  }
}
