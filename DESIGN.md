# DESIGN.md — Env Time Machine

Visual and interaction design direction for the whole product: marketing
landing page, auth, and dashboard. Written 2026-10-16 after studying
Linear, Vercel, Railway, Infisical, and Doppler.

Locked tokens this doc must not break: dark-first (`#0d1117` near-black,
layered surfaces, hairline `#262f3d` borders), one accent (electric blue
`#4d8dff`), semantic green/red/amber only, Inter for UI plus JetBrains Mono
for keys/hashes/timestamps, no gradients. The landing page gets the same
tokens. No marketing-exception palette.

## 1. Design principles

1. **The product is the demo.** Every impressive dev-tool landing page
   (Linear, Railway, Infisical) leads with the product itself, not stock
   art. Our hero shows a live-looking env diff with a rollback, animated.
   If a section cannot show the product, it probably should not exist.

2. **Density is a feature, calm is the wrapper.** Inside the app, pack
   information tight (Vercel tables, Linear lists) but keep chrome quiet:
   hairlines, 8px radius, one accent. Restraint in the frame makes the data
   feel expensive.

3. **Motion explains, never decorates.** Every animation on this product
   answers "what just happened": a diff sliding in, a rollback appending a
   new version, a toast confirming an undoable write. If an animation has no
   explanatory job, cut it.

4. **Trust is shown in the details.** Masked values, click-to-reveal,
   30-second clipboard scrub, read events in the audit log. The landing page
   says these things; the dashboard does them visibly. Never one without
   the other.

5. **Honest marketing for a portfolio product.** No fake customer logos, no
   invented stats, no "loved by teams at" strip with made-up companies. Use
   real incident stories (from RESEARCH.md) and real competitor pricing
   instead. Credibility beats decoration.

## 2. Landing page blueprint

Route: `/landing` (standalone layout, no app sidebar; the app keeps `/`).
Dark, same tokens as the dashboard. Max content width 1120px, generous
vertical rhythm (120-160px between sections).

### Nav
Sticky top, backdrop blur over the page background, hairline bottom border
that appears on scroll. Left: wordmark (electric-blue square mark + "env
time machine" in Inter 600). Center/right: links (How it works, Security,
Pricing), then "Sign in" (ghost) and "Get started" (accent button). Mobile:
links collapse behind a menu button; CTAs stay visible.

### Hero
Layout: centered text block, then the product visual below it, full width.
- Kicker: small caps mono, accent color: `VERSION CONTROL FOR ENV FILES`.
- Headline: Inter 800, 56-64px, tight tracking (-0.03em), two lines max.
  Proposed: "Every env change, diffed and one click from rollback."
- Subcopy: 18px, dim text, one sentence on the pain: "Someone deletes a
  variable, production crashes, and nobody knows what the old value was.
  Never again."
- CTAs: primary accent "Start free" (to /signup), ghost "See how it works"
  (scrolls to the how-it-works section).
- Product visual: a mock of the real History tab. A terminal-style panel
  showing a `.env` diff: one row marked UPDATED with red-old/green-new
  values masked as bullets, one row ADDED, then a "Rollback to v14" button
  that, on a loop, clicks itself: the diff panel slides a new version row
  to the top of a commit list beside it. This is the centerpiece. Build it
  in pure HTML/CSS/JS, reuse the real `.diff-old`/`.diff-new` badge styles
  so it looks like the app, not a mockup.
- Animation: hero text fades up on load (staggered 80ms). The diff demo
  auto-plays on a 6s loop, pauses when offscreen (IntersectionObserver),
  restarts on re-entry. Subtle accent glow behind the panel via box-shadow,
  not a gradient wash.

### Problem strip
Three incident cards in a row (from RESEARCH.md): the Redis change that
logged out 4,000 users, the node rotation that 502'd checkout, the missing
`.env.example` line. Each card: mono timestamp-ish label, one-line story,
"What we would have shown" line (the diff that would have caught it).
Scroll reveal, stagger 90ms. No fake logos anywhere on the page.

### How it works
Three numbered steps, alternating text/visual rows:
1. "Import your .env" — paste or upload, keys parsed, secrets masked on
   sight. Visual: paste animation into an editor mock.
2. "Every change becomes a version" — edit a value, a commit entry appears
   with your name, timestamp, and diff. Visual: the commit log growing.
3. "Roll back in one click" — pick any version, confirm what changes,
   production restored. Visual: rollback appending a new version row.
Each row reveals on scroll; the visual side animates once when it enters
the viewport. Keep copy to two sentences per step.

### Features (bento grid)
Six cells, Linear/Railway style: two large, four small.
- Large: "Diffs on every plan, not just Enterprise" (Vercel hides diffs
  behind Enterprise; we show them to everyone) with a mini diff visual.
- Large: "One-click rollback that respects production" (dev/staging: undo
  toast; prod: confirm dialog listing exactly which keys change).
- Small: masked by default, click-to-reveal; 30s clipboard scrub;
  audit log of every read and write; Vercel sync.
Hover: 1px lift, border brightens to accent at 40% opacity. No scale
transforms on cards (they feel cheap at this density).

### Security section
Trust block, quieter visual treatment (no animation except reveal):
- Server-side encryption at rest, values never in logs or audit records,
  reveal and copy treated as audited read events, decrypt-in-memory-only.
- One honest line: "v1 uses platform-managed encryption; per-project keys
  are on the roadmap." Saying the limit out loud builds more trust than a
  badge wall.

### Pricing teaser
Three tiers, middle highlighted with accent border: Free (1 project, 90-day
history), Team (flat per org, unlimited projects, 1-year history, Vercel
sync), and a line under it: "Flat pricing. We do not charge per seat like
Doppler ($21/user/mo) or per identity like Infisical ($18/identity/mo)."
Real numbers, cited on the pricing page.

### Final CTA + footer
Big centered block: headline "Stop debugging env vars at 2am.", one
accent button "Start free". Footer: four columns (Product, Resources,
Compare, Legal), status dot ("All systems operational" in green),
copyright line. Keep it to one screen height max.

## 3. Auth pages

Routes: `/login` and `/signup`, shared layout, shared form component with
different copy. Auth stays magic-link (Supabase OTP), matching the current
implementation. No password fields to design around.

Layout: split screen on desktop (form left 45%, brand panel right 55%),
centered card on mobile (brand panel hidden below 900px). This follows the
Linear/Stripe convention for dev tools.
- Brand panel: near-black with a faint grid pattern (CSS, 1px lines at 4%
  opacity), the animated diff visual from the hero at 70% scale, and one
  rotating proof line ("Every change diffed." / "One-click rollback." /
  "Audit log included."). Slow crossfade between lines, 5s each.
- Form panel: max-width 400px, wordmark at top, then:
  - Login: "Welcome back" / "Sign in with a magic link. No password to
    forget." Email field, "Send magic link" button. Below the divider:
    "New here? Create an account."
  - Signup: "Create your account" / "Free for one project. No card."
    Email field, "Create account" button. Fine print: "By continuing you
    agree to the Terms and Privacy Policy."
- States: sending (button spinner, 150ms min display so it never flashes),
  sent (check icon, "Check your inbox" + "Resend" link with 30s cooldown),
  error (inline red text under the field, never a toast; keep the typed
  email). Invalid email: validate on blur, not on every keystroke.
- Micro-interactions: input focus ring in accent (already in globals.css),
  button press scale 0.98, link hover underline. Nothing else. Auth pages
  should feel instant and boring, in the good way.

## 4. Dashboard refinements

### Shell
- Sidebar: add a workspace/project switcher at the top (current project
  name + chevron, dropdown lists all projects + "New project"). User menu
  at the bottom: avatar circle with initials, email in dim text, menu with
  Settings and Sign out. Active nav item: accent-tinted background at 12%
  opacity plus accent text (the current gray fill reads as disabled).
- Topbar (new, slim, 48px): breadcrumb (project name / env), env switcher
  moves here from the sticky bar on project pages, right side: Cmd+K
  button (search icon + "⌘K" kbd), user avatar. The env-bar CSS stays for
  the project page until the topbar ships; do not run both.
- Command palette (Cmd+K): Linear-pattern. Fuzzy list of projects,
  actions ("Add variable", "Rollback to version…", "Go to History"),
  recent pages. Keyboard navigable, Esc closes, arrow keys move. This is
  the single highest-leverage dashboard addition for the "real product"
  feel.

### Secrets table
- Sticky table header on scroll. Row hover reveals actions (reveal, copy,
  edit, delete) instead of showing them always; always-visible actions
  are visual noise at 50+ rows.
- Mono keys, tabular numerals for counts. Masked values render as
  eight bullets, never truncated real values.
- Column order: Key | Value | Updated | Actions. "Updated" shows relative
  time ("2h ago") with absolute timestamp on hover title.
- Loading: skeleton rows (shimmer 1.6s linear) instead of a spinner.
  Error: inline row-level retry, not a page error.

### Empty states
First-class, one per surface, each with a single next action:
- No projects: "Create your first project" + button. Subcopy: "Import a
  .env file and see your first diff in under a minute."
- Project with no variables: "No variables in dev yet" + "Add variable"
  and "Import .env" buttons side by side.
- No history yet: "No changes yet. Edits you make will appear here as
  versions you can diff and roll back."
- No audit entries: "Activity will appear here once your team starts
  making changes."
Each gets a small CSS-only illustration: a dashed rounded square with a
mono glyph (∅, +, ⟲). No stock illustrations, no emoji.

### Component polish notes
- Buttons: 8px radius everywhere (already), press state scale(0.98),
  120ms. Destructive actions stay text-red, never filled red.
- Dialogs: slide-up 12px + fade 180ms on open; overlay fade 150ms. Focus
  the first field on open, Esc closes, click-outside closes except when
  the form is dirty (then confirm).
- Toasts: bottom-center, slide-up 200ms, auto-dismiss 5s, pause on hover.
  Undo action in accent text. Prod writes never toast (confirm dialog
  instead), per the existing safety split.
- Badges: keep the Added/Updated/Deleted pill styles; add a "prod" badge
  (red tint) wherever a production value is shown.
- Numbers: tabular-nums on every count, timestamp, and version number.

### New pages needed ("proper pages for everything")
- `/settings` (account): email (read-only), "Sign out", danger zone with
  "Delete account" behind a confirm dialog.
- `/p/[id]/settings` exists; add team tab later, not v1.
- `/security`: public-facing encryption/trust page (linked from landing
  footer and signup fine print). One page, five sections matching the
  landing security block, plus the honest v1-limits line.
- `/pricing`: full pricing page (the landing teaser links here). Three
  tiers with the competitor comparison table.
- 404: branded ("This page does not exist." + "Back to projects"), same
  dark tokens. 500: same with "Something broke on our end."

## 5. Motion system

Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out, the Linear feel) for
entrances and reveals; `cubic-bezier(0.4, 0, 0.2, 1)` for hovers and
presses. No linear easing except shimmer loops and the typing caret.

Durations:
- Micro (hover, press, focus): 120-150ms.
- UI (dialogs, toasts, dropdowns, tab switches): 180-250ms.
- Reveals (scroll sections, hero stagger): 500-700ms, translateY 16-24px
  plus fade. Stagger children 60-90ms, max 5 items per stagger group.
- Demo loops (hero diff, brand panel): 5-6s cycles, ease-in-out.

Implementation: one `Reveal` component (IntersectionObserver, fires once,
`data-delay` for stagger). CSS transitions for micro/UI. No animation
library; the current codebase has zero deps for this and should keep it
that way.

Reduced motion: `@media (prefers-reduced-motion: reduce)` disables
reveals (content renders in final state), demo loops (show the end frame),
shimmer, and hover lifts. The Reveal component also checks
`matchMedia` and renders immediately. Test this; it is a requirement,
not a nicety.

## 6. What NOT to do

- No colored one-side borders (e.g. a left accent border) on any component:
  buttons, cards, boxes, notices, banners, callouts. Never. Use hairline
  full borders, background tints, or badges/pills for emphasis instead.
- No fake customer logos or invented stats. Ever.
- No gradients, no purple/blue washes, no glow-everywhere. One accent,
  used sparingly, is why the accent works.
- No stock photos, no abstract 3D shapes, no emoji in the UI.
- No lorem ipsum anywhere, including empty states and the 404 page.
- No hover-reveal of secret values. Reveal is click-only, always.
- No confirm dialog for reversible actions (use the undo toast). No toast
  for irreversible ones (use the confirm dialog).
- No second accent color. Amber is for warnings, not decoration; if amber
  appears anywhere non-semantic, the warning states stop meaning anything.
- No auto-playing video on the landing page. The animated HTML demo is
  lighter, crisper, and pausable.
- No "AI slop" signifiers: centered hero with three feature cards is fine,
  but every section must show the product or a real number. Decoration
  without information is the tell.
- Do not copy Doppler/Infisical layouts wholesale. Steal the patterns
  (commit-style history, red/green diff panels, undo toasts), not the
  pages.
