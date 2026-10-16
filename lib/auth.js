// Redirect target after the magic-link callback. Only same-origin paths are
// allowed; anything else (absolute URLs, protocol-relative, empty) falls back
// to "/". Open redirects are a trust-boundary issue, so this is explicit.
export function loginRedirectTarget(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/'
  }
  return next
}
