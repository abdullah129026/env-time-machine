import { gate, json, routeError } from '@/lib/guard'
import { getHistory } from '@/lib/env'

export async function GET(request, { params }) {
  const { id, env } = await params
  const g = await gate(id, env)
  if (g.error) return g.error

  const sp = new URL(request.url).searchParams
  try {
    const history = await getHistory(g.svc, id, env, {
      search: sp.get('search') ?? '',
      key: sp.get('key') ?? '',
    })
    // diffs carry the fixed mask only; plaintext never leaves the server
    return json(history)
  } catch (e) {
    return routeError(e)
  }
}
