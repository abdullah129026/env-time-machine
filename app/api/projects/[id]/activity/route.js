import { gate, json, routeError } from '@/lib/guard'
import { listAuditEvents } from '@/lib/audit'

// Activity log for the whole project, filterable. Membership-gated at
// the project level; rows carry no values by construction.
export async function GET(request, { params }) {
  const { id } = await params
  const g = await gate(id)
  if (g.error) return g.error

  try {
    const sp = new URL(request.url).searchParams
    const events = await listAuditEvents(g.svc, id, {
      actor: sp.get('actor') ?? '',
      action: sp.get('action') ?? '',
      env: sp.get('env') ?? '',
      since: sp.get('since') ?? '',
      until: sp.get('until') ?? '',
    })
    return json({ events })
  } catch (e) {
    return routeError(e)
  }
}
