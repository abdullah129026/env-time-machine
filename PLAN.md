# PLAN.md — Env & Secrets Time Machine

**Tagline:** Git history for your env vars. Every change diffed, attributed,
one click away from rollback.
**Researched:** 2026-10-14 (RESEARCH.md). **Planned:** 2026-10-15.
**Deadline:** 2026-10-20. **Repo:** abdullah129026/env-time-machine.

## 1. Problem

A deleted or mis-edited env var crashes production, and `.env` files have
no history. Small teams manage secrets in spreadsheets, Slack copy-paste, or
platform dashboards whose audit logs show who changed what but never the
before and after. Doppler costs $21/user/mo and Infisical $18/identity/mo;
dotenvx is free but has no team features, no audit trail, and no history UX.
Nobody owns the plain job for a 5-person team: versioned env history with
per-change diffs, who-changed-what, one-click rollback, and auto-sync to
Vercel/Render/Supabase, at flat pricing.

## 2. MVP scope (what ships Oct 20)

**Core: versioned env management with diffs and one-click rollback.**

In scope:
1. Auth via Supabase (email magic link, zero-config on the free tier).
2. Projects with three flat environments: dev, staging, prod. No folders,
   no nesting (folders are the upgrade path).
3. Secrets table per environment: key, masked value, click-to-reveal,
   copy-to-clipboard with 30-second scrub. Reveal and copy are logged as
   read events in the audit log.
4. Append-only versioning. Every set, edit, or delete writes a new version
   with author, timestamp, and a commit-style message. Full snapshot per
   version (simple, correct; deltas are the upgrade path). Versions carry a
   per-environment monotonic sequence number so "latest" is never a
   timestamp tie.
5. History view: commit-style log, per-version diff with Added/Updated/
   Deleted badges, red-old/green-new panels, values masked with explicit
   reveal. Search spans messages and keys; clicking a key in the secrets
   table shows its per-key change timeline (every version that touched it).
   When a delete and an add appear in the same version they render adjacent
   with a "possibly renamed" hint.
6. One-click rollback: restores a chosen version's state as a NEW version
   at the head of the stack (non-destructive, so undo is free). One safety
   mechanism per risk level: dev and staging rollbacks apply immediately
   with an undo toast; prod rollbacks require a confirm dialog that lists
   exactly which keys will change, and no toast. The dialog also shows
   which head version it was rendered from; the server recomputes the diff
   from the current head and rejects with 409 if the head moved, so a
   teammate's write in between forces a re-confirm instead of a stale
   rollback.
7. Import: paste a .env file to seed an environment (the dotenv-vault
   orphan story). A preview step parses the paste first and shows a table
   of new, updated, and deleted keys plus line numbers on parse errors; the
   user picks which to apply. Nothing is silently overwritten. Import uses
   replace semantics: the pasted file is the source of truth, so keys
   absent from the paste are marked deleted, and the preview says so.
8. Audit log: append-only table with actor, action, target key, time.
   Every mutation path (UI, API, sync) writes it. Never stores values.
   Change events link straight to the corresponding version diff in
   History, with values masked per the masking rules.
9. After any production change or rollback: a persistent, explicitly
   dismissed banner on the environment view names the platform and gives
   the exact redeploy steps, because Vercel pins env vars at build time.
   The project stores a deploy_target (vercel, render, supabase, none) set
   in Settings; the banner text follows it. This is the deploy-aware part
   of rollback in v1.
10. Docs: encryption explanation page (what v1 promises, what comes later),
    5-minute quickstart README.

Out of scope (named, not forgotten):
- Vercel/Render/Supabase API sync. The notices in (9) carry the deploy-aware
  story in v1. Full sync is the first post-MVP milestone.
- CLI, API tokens, folders/scopes, per-variable RBAC, approval flows
  (Doppler Change Requests), secret rotation, drift alerts, retention UI
  beyond the enforced 90-day purge.
- Per-project encryption keys. MVP relies on Supabase managed encryption at
  rest, plus masking, read auditing, and never logging values. The upgrade
  path is documented from day one (see 3.3).

## 3. Architecture

### 3.1 Stack

Next.js 16 (Active LTS; 15 went EOL 2026-10-21) + Supabase (Postgres, Auth,
hosted) on the free tier. Deploy: Vercel. Nothing else. No extra services,
no queue, no cache layer.

Why this fits Abdullah: Next.js + Postgres is his known stack, Supabase is
the same provider he already runs for project 1, and the whole MVP is one
codebase.

### 3.2 Data model

- `projects`: id (uuid), name, deploy_target (vercel/render/supabase/
  none, default none), created_by, created_at.
- `project_members`: project_id, user_id, role (owner/member), added_at.
  MVP teams are small; adding a member is one row. Invites are by email:
  the person signs in with magic link, then the owner adds them.
- `environments`: id, project_id, name (dev/staging/prod, seeded on
  project creation), version_seq (bigint, per-environment counter, starts
  0), created_at. One row per (project_id, name), unique.
- `versions`: id, project_id, environment_id, seq (bigint, the value of
  version_seq at write time; unique per environment), actor_id,
  actor_email, message (commit note; UI writes prefill a smart default
  like "Update DATABASE_URL" that the user can keep), kind (change,
  rollback, import), created_at. Append-only; nothing is ever updated or
  deleted. Import synthesizes "imported N keys from .env"; rollback
  synthesizes "rolled back to version <n>".
- `variable_states`: version_id, key, value (text), deleted (bool, default
  false). One row per (version_id, key), enforced by a unique constraint.
  Full snapshot per version: every version carries the complete state of
  its environment, including deleted keys as rows with deleted = true, so
  rollback can resurrect them. Index on (environment_id, seq desc).
- `audit_events`: id, project_id, environment_id (nullable), actor_id,
  actor_email, action (create/update/delete/reveal/copy/rollback/import),
  target_key (nullable), details (jsonb, never contains values), ip,
  created_at. Append-only. Reveal and copy write here. No login action in
  v1: magic-link sign-in completes inside Supabase's callback, outside the
  app's routes; session visibility is post-MVP.

Current state is derived, not stored: the highest-seq version's
variable_states (rows with deleted = false) is the environment's current
state, read in one query (join on max seq), never "latest id then states"
in two round trips. This keeps one source of truth and makes history and
current view the same query with different version ids. (ponytail: the
ceiling is row growth. One version per edit with full snapshots is fine
at this scale; Infisical does paid point-in-time recovery the same way.
Upgrade path: store deltas, rebuild state on read. A 90-day version
retention policy is enforced by a nightly Vercel cron route that deletes
versions older than 90 days, always keeping the head; the policy is real
because it runs, not because it is written down.)

### 3.3 Security model

- Masking happens server-side before serialization. The only route that
  ever returns plaintext is the single-value reveal route; history, diff,
  and current-state responses carry the mask only. Tests assert that those
  responses contain no value longer than the mask.
- Values are readable by server-side Supabase queries only. Reveal hits an
  API route that returns one value and writes a read audit event.
- Masked by default (●●●●●●). Reveal is click-only, never hover. Copy is a
  separate button; the clipboard is cleared after 30 seconds, and a toast
  says so ("Copied, clipboard clears in 30 seconds").
- All writes run inside one Postgres function (SECURITY DEFINER, invoked
  via RPC with service_role): version row + variable_states rows + audit
  row commit as one unit or roll back together. This RPC is the single
  mutation code path for the whole app (UI, API, import, rollback,
  seeding), so there is no way to write state without writing the audit
  row. A test kills the function mid-flight and asserts nothing partial
  persists.
- Mutation audit rows live inside that transaction: a failed audit write
  aborts the mutation. Read-event audit (reveal, copy) is best-effort with
  a logged error; it never blocks the reveal, because the read already
  happened.
- Because service_role bypasses RLS, every API route starts with a
  requireMembership(projectId, userId) check; without a project_members
  row the route returns 403. Tests assert that user B gets 403 on user A's
  project for both reads and writes.
- Supabase RLS on every table as a second layer, with explicit minimal
  GRANTs on every new table (select/insert/update/delete to service_role
  only; anon and authenticated get nothing).
- Migrations follow the project-1 rule: explicit GRANTs, because Supabase
  ends automatic grants on new public tables for existing projects on
  2026-10-30 and service_role bypasses RLS but not grants.
- Never log values: not in audit_events, not in server logs, not in error
  responses. Error paths are reviewed for value leakage before deploy.
- v1 encryption: Supabase managed encryption at rest for the database.
  Values are not stored in plaintext anywhere else.
  (ponytail: the ceiling is that the platform operator and anyone with the
  service_role key can read values. The upgrade path is per-project
  envelope encryption with keys held outside Supabase, and it is documented
  on the pricing/security page from day one so the promise never exceeds
  the implementation.)

### 3.4 API routes (Next.js, all membership-checked)

- `GET/POST /api/projects` (list, create; creation seeds 3 environments
  inside the same transactional RPC pattern, so a project is never
  half-seeded)
- `GET /api/projects/[id]` (project + environments + latest versions)
- `GET /api/projects/[id]/env/[env]` (current state for one environment;
  one query joining on max seq)
- `PUT /api/projects/[id]/env/[env]` (bulk replace, one version, same RPC,
  same prod confirm gate as single writes; used by import and by future
  sync integrations)
- `POST /api/projects/[id]/env/[env]/vars` (set/edit/delete one variable;
  one version per call via the RPC)
- `POST /api/projects/[id]/env/[env]/import` (parse pasted .env, preview
  first, then one version via PUT semantics)
- `GET /api/projects/[id]/env/[env]/history` (versions with diffs;
  masked, per the server-side masking rule)
- `POST /api/projects/[id]/env/[env]/rollback` (target version id plus
  the head seq the confirm dialog was rendered from; server recomputes
  the diff from the current head and rejects 409 if the head moved)
- `GET /api/projects/[id]/env/[env]/reveal` (one value; best-effort read
  audit, never blocks)
- `GET /api/projects/[id]/activity` (audit events, filterable by actor,
  action, environment, date; change events link to their version)
- `POST /api/projects/[id]/members` (add member by email)

Diff between two versions is computed in JS from their snapshots: small,
pure, testable.

The .env parser is specified, not improvised: strip `export ` prefixes,
honor single and double quotes with escapes, support multiline quoted
values, skip comments and blank lines, last-wins on duplicate keys,
skip-and-count lines without `=`, handle CRLF and a UTF-8 BOM, reject
null bytes. One parse function, fixture tests covering each rule.

## 4. UX/UI direction (from research, non-negotiable)

Dark-first dashboard; follow the system preference by default with an
explicit override toggle in the topbar. Inter for UI, JetBrains Mono for
keys, values, hashes, and timestamps. Near-black layered surfaces with
hairline borders, one accent (electric blue) plus semantic green/red/
amber. Never pure black, never gradient, no decorative color.

Layout: persistent sidebar for top-level sections (projects), per-project
tabs: Secrets | History | Activity | Settings. Environment as a sticky
context switch at the top of the project view, because every action is
scoped to an environment. Switching tabs never resets the environment.
Prod gets a persistent visual treatment (red-tinted environment label and
a thin banner strip on the prod view) so the blast radius is unmissable;
editing dev while thinking it is prod is the exact failure mode this
product exists to prevent.

Secrets tab: a dense table, one row per key, value masked, eye-toggle and
copy buttons per row, plus a key-search filter and an A-Z sort toggle.
Add and edit use a small dialog with a mono textarea so multiline values
(private keys, certs) are editable. Key rename is stated plainly in the
dialog copy as delete plus add, because a rename breaks the key's history
link and the user should know. The write rule: every write to prod (add,
edit, delete, import, rollback) shows a confirm dialog listing the changed
keys; dev and staging never get the dialog, they get the undo toast.

History tab: git-style commit log (message, author, timestamp, kind badge).
Each version row carries an overflow menu that reserves the home for
"Revert only this change" later; full-state restore is the only mode in
v1, surgical revert is the named upgrade path. Selecting a version shows
the diff: Added/Updated/Deleted badges, red-old and green-new panels side
by side, values masked with per-row reveal.

Activity tab: dense table (Time, Actor, Action, Target, Details), filters
for actor, action type, environment, and date range, AND-combined.
Clicking a row opens the detail drawer.

Empty states are first-class: a new project with no variables shows the
import panel and the .env paste box; history before the first write says
"no changes yet, every edit creates a version here"; activity with no
filter matches offers "clear filters"; an empty projects list shows the
create-project call to action.

Responsive floor, stated now: desktop-first is fine for a dev tool, but
the secrets table scrolls horizontally under 768px, diff panels stack
vertically, and the sidebar collapses to a top nav.

## 5. Milestones & dates

Oct 13-14: research. Done 2026-10-14 (commit b6a942a).
Oct 15: plan + review. This run.

Oct 15-16: scaffold + schema + auth. Next.js 16 scaffold, Supabase schema
with migrations and explicit grants, the transactional mutation RPC
(version + states + audit in one unit), magic-link auth, projects list +
creation with atomic seeding, project_members. 10-12 tests (membership
403s for reads and writes, seeding atomicity, version-seq ordering).

Oct 16-17: variable CRUD + versioning. set/edit/delete via the RPC,
current-state single-query read, the .env parser with fixture tests, the
import preview flow. Script the demo-data seeding here so it doubles as
end-to-end test data. 10-12 tests (parser rules, snapshot correctness,
deleted keys resurrectable on rollback, server-side mask leak check on
history/diff responses).

Oct 17-18: history, diff, rollback. History view with search and per-key
timelines, per-version diffs, rollback with stale-head 409 protection,
prod confirm gate on every write type, dev/staging undo toasts,
redeploy-required banners driven by deploy_target. 8-10 tests (diff
correctness incl. the possibly-renamed hint, rollback appends new head,
409 on moved head, prod gate coverage).

Oct 18-19: activity log + security UX. Audit table with filters (actor,
action, environment, date), reveal/copy logging, 30-second clipboard
scrub with the explanatory toast, security/encryption explainer page.
6-8 tests.

Oct 19-20: deploy + polish. Vercel deploy, Supabase on the free tier, the
nightly 90-day purge cron route, a check of the current free-tier magic
link email limits before launch day, demo project with realistic history,
README quickstart, final empty-state and responsive-floor pass. Deploy URL
verified live.

If a milestone finishes early, pull the next one forward (the standing
rule). Vercel API sync stays out unless everything above is done and
green before Oct 19.

## 6. Deploy targets (free tiers)

- Dashboard: Vercel (Next.js 16, same as project 1).
- Database + Auth: Supabase free tier. One new project, separate from the
  API Contract Firewall one, so billing and keys stay clean.
- Needs from Abdullah: the Supabase project creation clicks and the
  dashboard env vars in Vercel (SUPABASE_URL, SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY), plus running the SQL migrations in the
  Supabase SQL editor, same as project 1. He has done this flow twice
  already.

## 7. Risks & mitigations

- Trust: storing production secrets is the highest-trust ask in the
  category. Mitigation: the security page says exactly what v1 does and
  does not do, the audit log is real, and the per-project-key upgrade path
  is named from day one. Messaging is validated with one real team before
  any polish budget goes to marketing copy.
- Mutation paths: UI, API, and later sync must all write audit events.
  Mitigation: the transactional mutation RPC is the one code path that
  mutates state; every writer (UI, API, import, rollback, seeding) calls
  it, so there is no way to change state without writing the audit row.
- History growth: full snapshots per version grow rows linearly.
  Mitigation: 90-day retention policy named in v1; deltas are the named
  upgrade path.
- Incumbent velocity (Doppler/Infisical) and Envpilot: the wedge is the
  small-team price and the diff/rollback UX, not feature parity. Do not
  chase their checklists.

## 8. Definition of done (Oct 20)

Vercel deploy URL responds with a working product: sign in, create a
project, import a .env, edit a variable, see the commit-style history with
a masked diff, roll back to an earlier version with the confirm dialog,
see the audit entry for each action, and read the security page. Tests
green, `next build` clean, migrations carry explicit grants, no values in
any log or error response. Demo project with realistic history seeded for
the showcase.
