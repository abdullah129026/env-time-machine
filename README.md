# Env Time Machine

Version control for `.env` files. A team dashboard with per-environment
(dev/staging/prod) secrets, git-style history with masked diffs, per-key
change timelines, one-click rollback, and an audit log that records every
read and write. Built for project 2 of a 10-project portfolio program.

Live: https://env-time-machine.vercel.app

## Quickstart

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

1. Create a Supabase project (free tier). This is the database and auth.
2. In its SQL editor, run the migrations in `supabase/migrations/` in
   order: `0001_schema.sql`, `0002_rpc.sql`, `0003_audit_action_change.sql`.
3. Copy `.env.example` to `.env` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (Supabase project settings, API section)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page, server only, never commit)
4. `npm run dev`, open http://localhost:3000, sign in with a magic link.

If your database ran `0001` before 2026-10-17, also run `0003`: it fixes a
check constraint that rejected ordinary writes.

## Demo data

`scripts/seed-demo.mjs` seeds a demo project with a realistic history
(import, edits, a delete, a rollback-style change) across dev, staging,
and prod, through the same `commit_version` RPC the API routes use:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_USER_EMAIL=... node scripts/seed-demo.mjs
```

Sign in via magic link once first; the script needs an existing auth
user for the actor fields. It never prints values.

## Deploy (Vercel)

The app is a plain Next.js app; root directory is the repo root. Set the
three `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` env vars from the quickstart,
plus `CRON_SECRET` (any random string) so the nightly purge cron can
authenticate. `vercel.json` schedules `/api/cron/purge` at 03:00 daily;
Vercel sends the `CRON_SECRET` bearer automatically on cron requests.

## How it works

- Every write (set, edit, delete, import, rollback) calls one Postgres
  function, `commit_version`: version row plus a full snapshot plus the
  audit row, in one transaction. There is no other write path.
- Values are masked server-side before serialization. The only route that
  returns plaintext is the single-value reveal route, and every reveal or
  copy writes a read audit event.
- Rollback is non-destructive: it appends a new head version. Prod writes
  need a confirm dialog (server-enforced); dev/staging writes get an undo
  toast. The history tab shows masked diffs, per-key timelines, and a
  "possibly renamed" hint when an add and a delete land together.
- 90-day retention: the nightly cron deletes versions and audit events
  older than 90 days, always keeping each environment's head.

## Security model

Short version: membership is checked on every API route (service_role
bypasses RLS), masking happens server-side, reveal/copy are logged, and
values never appear in logs, audit rows, or error responses. The honest
limits are on the /security page: v1 uses platform-managed encryption at
rest, not per-project keys, so anyone with the service_role key can read
values. Read it before trusting it with real secrets.

## Tests

`npm test` runs the node:test suite (zero dependencies): parser rules,
diff correctness, mutation paths, masking leak checks, prod-gate and
rollback coverage, audit filters, retention rules, and migration SQL
consistency checks.
