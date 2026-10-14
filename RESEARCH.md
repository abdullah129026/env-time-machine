# RESEARCH.md — Env & Secrets Time Machine

**Product:** Version control for env files. A team dashboard where every env var
change is versioned: per-change diffs, who-changed-what, one-click rollback,
auto-sync to Vercel/Render/Supabase, full audit log.
**Audience:** small dev teams, indie hackers, solo developers with multiple projects.
**Researched:** 2026-10-14. All facts below are from the cited sources; anything
not verifiable is marked uncertain. Pricing figures come from secondary sources
(devtoollab, vendor blogs); re-verify on the vendors' own pages before quoting them.

---

## 1. Problem space & demand

**A deleted or mis-edited env var crashes production, and `.env` files have no history.**

- The incident shape repeats everywhere: a Redis connection string changed without
  review, deployed at 3:52 PM, 4,000 users logged out by 5 PM. Source: a Medium
  post-mortem from April 2026
  (https://medium.com/@developer_programmer/the-code-review-i-skipped-because-its-just-a-config-change-crashed-our-api-for-4-000-customers-32160249658a)
- Config drift is "a production incident with a long fuse": checkout pods returned
  502s after a node rotation because an env var existed only on the replaced
  nodes. Set once via a console, never written down, lost on rotation.
  (https://dev.to/_66d02d0cc1ece7d1137c5f/configuration-drift-is-a-production-incident-with-a-long-fuse-23b7)
- A missing `.env.example` line: the variable existed on the developer's machine
  but never made it to production. Tests, review, and build all passed.
  Production found it. The author's fix was a PR check that diffs
  `process.env.*` usage against `.env.example`.
  (https://dev.to/utsavmishra25/a-missing-line-in-envexample-took-down-our-prod-so-i-built-a-pr-check-for-it-hfp)
- A stray `.env.production.local` with empty values (written by `vercel env pull`
  for sensitive vars) broke 13 Next.js pages on every local production build for
  a month, invisible to git and to dev mode.
  (https://dev.to/phi_blankslate/a-stray-env-file-broke-exactly-13-pages-of-my-nextjs-build-and-dev-mode-never-saw-it-i44)
- The flagship case from 2026: a Firebase GA4F config cleanup shipped a malformed
  payload that crashed a large number of iOS apps on launch. Google's postmortem
  notes the SDK never validated that a flag's name was not nil.
  (https://blog.pragmaticengineer.com/the-pulse-firebases-global-outage-poor-response/)

**How teams cope today:** encrypted files in git (SOPS, dotenvx) give history and
rollback for free, with SOPS keeping key names readable so diffs stay meaningful;
`.env.example` treated as a contract with startup validation (t3-env, envalid,
zod schemas) so the app fails on boot with a clear message instead of 500ing at
runtime; PR checks that compare env usage against the example file; and, still
the default for many small teams, spreadsheets and Slack/Notion copy-paste.
(https://devtoollab.com/blog/best-secrets-management-tools)

**Demand read:** the failure mode is universal (every team above is small, none
ran a secrets platform) and the workaround stack is manual. Nothing in the
workarounds answers "who changed what and when" with a diff, or rolls back with
one click. That is the wedge.

---

## 2. Competitive landscape (2024–2026)

### Full secrets platforms

- **Doppler.** Versioned secrets, one-click rollback, who-read-what/IP/device
  access logs, Change Requests (approval flow with per-change diffs, launched
  2024), 50+ sync integrations, strong CLI. Pricing (Aug 2026, devtoollab):
  Developer free for 3 users ($8/mo per extra), Team $21/user/mo (change
  requests, SAML SSO, RBAC, 90-day logs, rotation), Enterprise adds dynamic
  secrets and log forwarding. Per-human pricing: machine identities and AI
  agents are free, a deliberate 2026 edge (Sept 2026 push: MCP server, scoped
  auto-rotating machine credentials).
  (https://devtoollab.com/blog/best-secrets-management-tools,
  https://www.helpnetsecurity.com/2026/09/08/product-showcase-doppler-secrets-management-platform/,
  https://tfir.io/secrets-management-ai-agents-doppler-amber-britton/)
  Weaknesses for our target user: the paid features a team actually wants
  (change requests, real log retention) start at $21/user/mo; server-side key
  custody. No major public 2025-2026 security incident found (uncertain).
- **Infisical.** MIT-licensed core, ~25-27k GitHub stars (mid-2026), founded
  2022. Dashboard, CLI, SDKs, K8s operator, 60+ integrations, 140+ type secret
  scanning, real self-hosting (roughly half of deployments). Pricing:
  Free $0/mo up to 5 identities; Pro $18/identity/mo per its own pricing blog
  June 2026 (devtoollab says $20/mo annual, $23 monthly: verify) adds
  versioning, point-in-time recovery, 90-day audit logs, rotation, SAML;
  Enterprise custom. The catch is identity-based billing: an identity is any
  human OR machine, so 8 engineers with 150 services and agents is roughly
  $168/mo on Doppler Team but four figures on Infisical Pro.
  Customers include Hugging Face, LG, Volkswagen.
  (https://infisical.com/blog/secrets-manager-pricing,
  https://dev.to/beton/infisical-pricing-teardown-2026-1ang,
  https://devtoollab.com/blog/best-secrets-management-tools)
- **HashiCorp Vault.** The reason small teams avoid it is operational, not
  licensing: a stateful cluster to unseal, back up, and upgrade, a steep
  learning curve, and a subpar UI ("a heavy answer when you just have fifteen
  YAML files with API keys"). News: IBM acquisition closed 2025; Vault went
  BUSL 1.1 in 2023 (OpenBao fork, MPL 2.0, NVIDIA adopter); HCP Vault Secrets,
  the cheap SaaS tier, went end-of-sale June 30 2025 and end-of-life by
  July 1 2026, pushing users to quoted HCP Vault Dedicated.
  (https://blog.teliaz.com/2026/09/24/secrets-management-beyond-environment-variables-vault-sops-sealed-secrets-and-rotation-that-works/,
  https://devtoollab.com/blog/best-secrets-management-tools)
- **AWS Secrets Manager.** $0.40/secret/mo + $0.05 per 10k calls, no permanent
  free tier. A few dozen secrets is a few dollars; it multiplies across envs
  and regions (1,500 secrets used 20x/day ≈ $604.50/mo). Rotation is built-in
  only for RDS/Redshift/DocumentDB; no diffs of config changes, nothing for
  local dev, no approval flows. Solves storage, not the env workflow.
  (https://www.akeyless.io/blog/aws-secrets-manager-cost/,
  https://infisical.com/blog/aws-secrets-manager-complete-guide)

### The lightweight lane

- **dotenv-vault: deprecated (2026).** The `.env.vault` format is officially
  deprecated. Active development moved to **dotenvx**, the free OSS successor
  by the original dotenv creator. dotenvx encrypts in place with no account,
  but the private key still has to reach every teammate and CI job through
  some other channel, and there is no per-person access control or audit trail.
  (https://dev.to/rafay99/dotenv-vault-is-deprecated-heres-your-migration-path-21ke)
- **Envpilot.** MIT open-source env var manager aimed at dotenv-vault
  refugees. Per-variable RBAC, audit log (who read what, when, from where),
  per-environment values with enforced key uniqueness, flat pricing (free for
  3 teammates and 3 projects, paid tier flat per org). The closest direct
  competitor in our lane; treat its comparison pages as vendor marketing.
  (https://dev.to/rafay99/dotenv-vault-is-deprecated-heres-your-migration-path-21ke)
- **SlickEnv.** CLI-first, encrypted sync, version history, team sharing.
  (https://medium.com/@jjackofall/slickenv-vs-doppler-vs-dotenv-vault-which-is-right-for-your-team-f0a209654be5)
- **Otter Vault Teams.** End-to-end encrypted key sharing; every key records
  where it is deployed (the Vercel variable, the GitHub Actions secret, the
  .env file). Teams tier $20/mo early-bird (normally $29) for up to 10 people.
  (https://www.producthunt.com/p/otter-vault/new-otter-teams-share-api-keys-with-your-team-with-every-deploy-mapped)
- **SOPS + age.** CNCF sandbox. Encrypts values in YAML/JSON/.env, keys stay
  readable so git diffs stay meaningful, decrypted at deploy time. No server,
  no bill, no rotation, no audit log.
  (https://devtoollab.com/blog/best-secrets-management-tools)

### Platform-native env management (the default we displace)

- **Vercel.** Env vars under project Settings, per-environment values.
  Sensitive vars are write-once via API (value never returned, even to
  integrations). Values are pinned at build time: editing a var does not
  change running deployments, a redeploy is required. Activity Log shows who
  changed what and when on every plan, but with no before/after values or
  diffs; the real audit log with CSV/SIEM export is Enterprise only. After the
  April 2026 breach, new vars default to sensitive.
  (http://infisical.com/blog/vercel-environment-variables,
  https://dev.to/itsmearka/doppler-vercel-integration-issue-4cdn)
- **Render.** Audit logs record env var created/modified/deleted/viewed, who
  and when, but no value diffs. (https://render.com/docs/audit-logs)
- **Supabase.** Edge Function secrets are set via dashboard or CLI. No
  documented version history, diff view, or per-change audit UI found in
  research (uncertain). New key system in 2026 (sb_publishable_*/sb_secret_*)
  replaces the legacy JWT keys.
  (https://github.com/lockemind/puras_cinderelas/blob/HEAD/docs/handoffs/handoff-secrets-rotation-2026-06-15.md)

### Security incidents shaping the category

- **Vercel, April 2026.** Attackers entered through a compromised Context.ai
  OAuth grant from a Vercel employee, pivoted into Vercel systems, and
  enumerated/decrypted non-sensitive environment variables. Vercel engaged
  Mandiant, notified law enforcement, told all customers to rotate
  non-sensitive env vars, and moved new var creation to sensitive by default.
  (https://securityonline.info/vercel-breach-2026-nextjs-supply-chain-threat/,
  https://venturebeat.com/security/vercel-breach-exposes-the-oauth-gap-most-security-teams-cannot-detect-scope-or-contain)
- **GitGuardian, August 2026.** 4,576 distinct n8n API tokens in public GitHub
  commits across 1,255 hostnames; of 896 reachable instances, 321 accepted at
  least one leaked token with no exploit needed. Deleted-from-git keys still
  worked. (https://dev.to/thesolutionscraft/is-your-n8n-api-key-already-leaked-321n)
- **MCP/agent ecosystem.** 24,000+ secrets leaked in MCP configs in its first
  year; OpenClaw Shodan exposure January 2026 (4,000+ agent gateways, many with
  zero auth). (https://github.com/edwardshez/ai_osint)

**The gap:** the category splits between expensive platforms (per-seat or
per-identity, compliance dashboards, features a 5-person team never touches)
and free CLIs with no access control, no audit trail, and no answer for
who-changed-what. Nobody owns the plain job: versioned env history with
per-change diffs, who-changed-what, one-click rollback, and auto-sync to
Vercel/Render/Supabase, at flat pricing instead of per seat or per identity.

---

## 3. 2026 UX/UI best practice for a secrets-management dashboard

Studied product UIs (Doppler, Infisical, Vercel, Netlify, Supabase, 1Password),
version-history patterns (GitHub, Google Docs, Infisical pit recovery), rollback
UX (Linear undo conventions), and audit log UIs (GitHub, Vercel, Netlify).

### How the leading products present env/secrets

- **Doppler:** workplace > project > config hierarchy; configs map to
  environments (dev, staging, prod preconfigured). Secrets table inside the
  selected config; "Add Secret" and "Import Secrets" (paste a .env file) are
  the entry points. Config changes feed a commit-style log; entries link to a
  detailed log that can be rolled back at any time. Enterprise splits logs
  into Activity Logs (who added/edited/deleted) and Access Logs (who read
  which secret, how, when, first/last read timestamps).
  (https://docs.doppler.com/docs/workplace-logs,
  https://securityboulevard.com/2025/09/5-ways-doppler-reduces-risk-in-enterprise-secrets-management/)
- **Infisical:** project > folder path > environment hierarchy; folders group
  related secrets and double as an access-control boundary. The secrets table
  header carries an "N Commits" button. The three-dot row menu opens Version
  History; each earlier version has a Restore Version action with confirmation.
  Restoring creates a new secret update, so the audit trail is append-only.
  (https://github.com/bluedepin/infisical-cli-tutorial/blob/HEAD/README.md,
  https://github.com/Infisical/infisical/pull/7946)
- **Vercel:** env vars under project Settings > Environment Variables, one row
  per key with per-environment values; values pinned at build time (redeploy
  required). After the 2026 breach they shipped an overview page for all env
  vars and a cleaner UI for marking vars sensitive.
  (https://github.com/parthnarkar/parth-builds-os/blob/main/Resources/Deploying%20on%20Vercel.md)
- **Netlify:** env vars carry a key, a scope (functions, builds, runtime,
  all), and contextual values per deploy context. "Contains secret values"
  marks vars for extra access restrictions. Filters by key/scope/context; the
  filtered set can be copied in .env format. Every change lands in the team
  audit log; deploy logs auto-mask detected secret values.
  (https://docs.netlify.com/build/environment-variables/overview/,
  https://docs.netlify.com/resources/checklists/security-checklist/)
- **Supabase:** function secrets under Project Settings > Edge Functions >
  Secrets, a simple key list. API keys get a Reveal action; secret keys are
  shown once on creation and never again.
  (https://dev.to/russel_dsouza_bd584a3cb2a/the-supabase-edge-functions-testing-playbook-unit-auth-webhooks-and-local-integration-tests-5bo2,
  https://medium.com/@sevicdev/supabase-basics-with-node-js-e3d6b302ebd9)
- **1Password (Secrets Automation):** secrets are items in vaults, not raw
  key-value pairs. `op run` injects them as process env vars. The Environments
  feature manages project .env secret sets that load without exposing
  plaintext. Developer Watchtower flags exposed credentials such as plaintext
  .env files. For our product: keep the flat KEY=VALUE model developers
  expect from .env files; the vault-item model is built for human
  credentials, not env vars.
  (https://github.com/ethchor/arc/blob/HEAD/docs/REFERENCE-1password-bitwarden.md)

### Version-history and diff patterns worth copying

- **Commit-style logs won.** Doppler and Infisical both converged on git-style
  history: chronological entries, author, timestamp, per-entry diff, restore
  actions. This is the reference model for our History tab.
  (https://docs.doppler.com/docs/workplace-logs,
  https://github.com/incpo/infisical/blob/HEAD/docs/documentation/platform/pit-recovery.mdx)
- **Point-in-time recovery, Infisical's design:** a commit history side panel
  scoped to an environment and folder, grouped by date; each row shows the
  commit message, author, absolute timestamp, commit hash, and resource
  counts; search spans messages, keys, and folders; Author filter;
  oldest/newest sort. Selecting a commit shows Added/Updated/Deleted badges
  per secret with red previous-state and green new-state panels, plus
  "Expand all to full state". Secret values stay masked in these views.
  (https://github.com/Infisical/infisical/pull/7946)
- **Two restore modes, and we should copy both:** "Revert changes" (surgical,
  reverts only that commit's changes, keeps everything after it) and "Roll
  back to this commit" (full state restoration, discards everything after,
  creates a new commit for the rollback itself). Rollbacks are scoped per
  folder, each folder keeping its own timeline.
  (https://github.com/incpo/infisical/blob/HEAD/docs/documentation/platform/pit-recovery.mdx)
- **What makes a key-value diff readable:** one row per key, old vs new side
  by side or stacked, Added/Updated/Deleted badges instead of raw +/- gutters,
  values masked with an explicit reveal. Infisical's red-old/green-new panels
  with badges is the pattern to copy.
  (https://github.com/Infisical/infisical/pull/7946)
- **Google Docs version history** is the secondary reference: right-hand
  panel listing versions by time and author, preview on select, "Restore this
  version". Restoring is non-destructive: the current version becomes an entry
  in the list, so nothing is ever lost. Named versions ("First draft") are
  easier to find than timestamps alone.
  (https://www.pcworld.com/article/3214384/the-google-docs-backup-trick-every-user-should-know.html)
- **Blame vs history:** for config lines, full line history beats blame: blame
  only shows the most recent touch on each line.
  (https://github.com/cavo789/blog/blob/HEAD/.unpublished/vscode-gitlens/index.md)

### Rollback and undo UX

- **Undo toast beats confirm dialog for reversible actions.** Linear's
  convention: do the thing immediately, show a toast with Undo for 5-6
  seconds (pauses on hover/focus), commit when the window closes. No new
  dependency needed (sonner or a small custom bar). Confirmation dialogs are
  kept for irreversible actions only (key destruction, session revocation).
  (https://github.com/4keyy/planora/commit/0b333a42590019897df9108211da41b5074337ba,
  https://github.com/iduuck/dots/blob/HEAD/config/opencode/skills/design-thinking/references/ux-patterns.md)
- **Make rollback non-destructive and it earns the toast treatment.**
  Infisical, Doppler, and Google Docs all implement restore as an append: the
  rollback creates a new version at the top of the stack, so "undo the
  rollback" is just restoring the previous head. A destructive restore
  (history rewrite) would demand a confirm dialog instead.
  (https://github.com/incpo/infisical/blob/HEAD/docs/documentation/platform/pit-recovery.mdx,
  https://www.pcworld.com/article/3214384/the-google-docs-backup-trick-every-user-should-know.html)
- **Safety rails for applying an old version to production,** from the
  references: a confirmation dialog that lists exactly which keys will change
  (Infisical's AlertDialog on Restore Version); a scope checkbox when the
  blast radius is wider than one screen; peer approval for high-risk
  environments (Doppler Change Requests, heavy for our MVP, revisit later);
  the rollback itself recorded as a new auditable entry with its actor.
  (https://github.com/Infisical/infisical/pull/7946,
  https://www.globenewswire.com/de/news-release/2024/10/03/2957877/0/en/Doppler-Launches-Change-Requests-to-Strengthen-Secrets-Management-Security-with-Audited-Approvals.html)
- One subtle pattern: on revert, preserve the replaced value into history so
  the user can toggle back and forth without data loss.
  (https://dev.to/freerave/dotghostboard-21-leviathan-cryptographic-vault-backups-secret-expiry-password-history-part-3pk8)

### Audit log UI patterns

- **GitHub's audit log** is the density reference: Filters dropdown plus
  typed search qualifiers (`action:`, `actor:`, `created:` date ranges), rows
  showing action, actor, target. Enterprise Cloud retains 180 days; the API
  mirrors the UI.
  (https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/searching-the-audit-log-for-your-enterprise)
- **Vercel's team activity:** event feed with type, date-range, and project
  filters, rows identifying the actor (user or system) and categorizing the
  event type.
  (https://github.com/mark-maher-moris/vero-for-vercel/blob/HEAD/docs/IMPLEMENTATION_SUMMARY.md)
- **Common column set:** Time, Actor, Action, Target, Details, Outcome/Status.
  Filter bar above the table: actor autocomplete (service tokens shown as
  `svc:name`), action-type dropdown, date range. Filters combine with AND.
  Clicking a row opens a detail drawer with the full record.
  (https://github.com/nseniak/mcphero/blob/HEAD/docs/audit-log.md,
  https://github.com/nofaceprotocol5-prog/platform-docs-public/blob/HEAD/public/admin/security-access/audit-logs.md)
- For a secrets product, "who changed what" rows expand to a before/after
  diff with values masked, not plaintext. Read events log the fact of access
  (who, when, via what client, IP) and never the value.
  (https://tfir.io/secrets-management-ai-agents-doppler-amber-britton/,
  https://github.com/nseniak/mcphero/blob/HEAD/docs/audit-log.md)
- **Log the mutation path, not just the UI path:** Netlify captures every env
  var create/modify/delete in the team audit log regardless of whether it
  came from UI, CLI, or API.
  (https://docs.netlify.com/build/environment-variables/overview/)
- Timeline grouping (Today, Yesterday, This Week) suits activity feeds; dense
  tables suit compliance review. Ship the table first; the feed is a view
  option, not the model.

### Design systems and type/color conventions (2026)

- **Dark-first is the standard** for developer tools in 2026. Linear and
  Vercel treat dark as the default, not a toggle. Supabase pairs dark
  surfaces with green highlights. Light mode is a secondary option via
  system preference with an explicit override.
  (http://adminlte.io/blog/dark-dashboard-templates/,
  https://github.com/itsdevcoffee/mojovoice/blob/HEAD/docs/research/2026-02-08-developer-tool-ui-patterns.md)
- **Linear is the restraint reference:** near-black surfaces, muted hairline
  borders, one accent (their indigo #5E6AD2), hierarchy doing the work
  instead of decoration.
  (https://github.com/therocksss/hermes-skills-portfolio/blob/HEAD/skills/frontend-design-toolkit/SKILL.md)
- **Vercel's system:** monochromatic black/white/gray, color reserved for
  status and interactive states; flat elevation (hairline ring borders, no
  drop shadows); 6px corner radius; compact density with a 4px spacing base;
  14px body.
  (https://github.com/caio-overmind-ventures/designkit/blob/HEAD/portable/vercel.com/README.md)
- **Typography:** one sans for UI plus one mono for technical content.
  Vercel uses Geist + Geist Mono; Linear uses Inter Tight + Inter. For this
  program Inter is the locked body face (per the project-1 preference);
  JetBrains Mono or Geist Mono covers secret keys, hashes, and timestamps.
  Tabular numerals for anything compared in a column. Weights at 400/500/600.
  (https://github.com/soheilhasanjani/portfolio-builder/blob/HEAD/vercel.design.md)
- **Color rationing:** one accent plus semantic red/amber/green. Do not use
  amber as the primary accent; it reads as "warning" everywhere and confuses
  real warning states.
  (https://github.com/tshrjn/evolve-swarm/blob/HEAD/thoughts/taras/research/2026-02-25-dashboard-ui-design-best-practices.md)
- **Dark-mode construction:** near-black neutrals, never pure #000 (too harsh,
  kills elevation perception); off-white text (#E8EBF0 range) instead of pure
  white; layered surfaces (each level ~5% lighter); OKLCH is the current
  standard for building palettes (Linear migrated, shadcn/ui defaults to
  it); borders as low-alpha white overlays, not hard gray lines.
  (https://github.com/tshrjn/evolve-swarm/blob/HEAD/thoughts/taras/research/2026-02-25-dashboard-ui-design-best-practices.md,
  https://github.com/itsdevcoffee/mojovoice/blob/HEAD/docs/research/2026-02-08-developer-tool-ui-patterns.md)
- **Layout convention:** persistent sidebar for top-level sections, tabs for
  sub-sections within a page. Secrets products use sidebar (projects) plus
  per-project tabs (Secrets, History, Activity, Settings). Command palette
  (Cmd+K) for navigation and actions, per the Linear pattern.
  (https://github.com/therocksss/hermes-skills-portfolio/blob/HEAD/skills/frontend-design-toolkit/SKILL.md)

### Security-sensitive UI details

- **Mask by default, always.** Convention is bullet or asterisk masking
  (●●●●●● or ********), never showing a prefix or suffix in team contexts.
  (https://dev.to/zeybek/how-camouflagenvim-masks-secrets-in-neovim-without-leaking-a-frame-1fao)
- **Reveal on explicit click, never on hover.** Hover-reveal leaks to
  shoulder-surfers and tooltip previews. The eye-toggle pattern (click to
  reveal, click to hide) is the standard.
  (https://github.com/ulloasp/mlsuite/blob/HEAD/tasks/lessons.md,
  https://docs.warp.dev/support-and-community/privacy-and-security/secret-redaction/)
- **Separate reveal from copy.** The copy button places plaintext on the
  clipboard; revealing only changes what the screen shows. Copies from a
  masked view should be a deliberate user action, never an accident of
  selecting text.
  (https://docs.warp.dev/support-and-community/privacy-and-security/secret-redaction/)
- **Scrub the clipboard.** Auto-clear copied secrets after ~30 seconds, and
  where the platform allows, mark clipboard content as sensitive with an
  expiration so previews stay hidden and it does not sync across devices.
  (https://dev.to/freerave/dotghostboard-21-leviathan-cryptographic-vault-backups-secret-expiry-password-history-part-3pk8)
- **Treat reveal as a read event.** Doppler's Access Logs record who read
  which secret, from what IP and device, with first/last read timestamps. Our
  audit log should do the same for reveal and copy actions.
  (https://tfir.io/secrets-management-ai-agents-doppler-amber-britton/,
  https://securityboulevard.com/2025/09/5-ways-doppler-reduces-risk-in-enterprise-secrets-management/)
- **Never put values in logs or audit records.** Log the fact of access and
  the outcome, never arguments or return values. Netlify's deploy logs
  auto-mask detected secret values; error responses must be scanned for
  secret leakage before they render.
  (https://github.com/nseniak/mcphero/blob/HEAD/docs/audit-log.md,
  https://docs.netlify.com/resources/checklists/security-checklist/)
- **Decrypt in memory only; discard on close.** The history viewer pattern
  decrypts when opened and drops the plaintext when the viewer closes, so a
  value never sits in a long-lived store.
  (https://dev.to/freerave/dotghostboard-21-leviathan-cryptographic-vault-backups-secret-expiry-password-history-part-3pk8)
- Uncertain: none of the competitors publish session or idle-timeout UI
  behavior for their dashboards (e.g. re-auth before reveal, auto-lock
  timers). If we add reveal-gating, we would be setting the convention, not
  following one.

**Concrete design direction:** dark-first dashboard (light as secondary
toggle following prefers-color-scheme), Inter sans + JetBrains Mono, near-black
layered surfaces with hairline borders, one accent (electric blue) +
semantic green/red/amber, persistent sidebar with per-project tabs
(Secrets | History | Activity | Settings), environment as the top-level sticky
context switch, git-style commit history with Added/Updated/Deleted badges and
red-old/green-new diff panels, non-destructive restore (rollback appends a new
version, undoable via toast), audit table with Time/Actor/Action/Target/
Details columns and AND-combined filters, masked-by-default values with
click-to-reveal and 30-second clipboard scrubbing. No gradients, no decorative
color.

### What we are deliberately not copying

- Vercel-style write-once sensitive vars: hostile to a time-machine product
  whose job is versioning everything. We version sensitive values like any
  other, with masking and read-auditing as the guardrails.
- Doppler's Change Requests approval flow: right for enterprise compliance,
  heavy for an MVP aimed at small teams. The audit log plus append-only
  history gives most of the safety at a fraction of the complexity. Revisit
  when teams ask for it.
- 1Password's item/vault model: built for human credentials, not env
  key-value pairs.

---

## 4. Feature & market differentiation

A small indie-built tool can own what the poles leave open:

1. **Diff-level history free.** Vercel's Activity Log shows who changed what
   but no before/after; the real diff view is Enterprise only. Showing exact
   per-change diffs on every plan is an upgrade over the platform default.
2. **dotenv-vault's orphaned users.** The format is deprecated as of 2026 and
   its replacement (dotenvx) has no team features. That is a ready-made
   audience that already thinks in env files: an "import your .env" flow
   speaks their language.
3. **Rollback tied to deploy reality.** Vercel env changes need a redeploy to
   take effect, which is where rotations silently break. One-click rollback
   that also triggers the redeploy (or tells you exactly what to do) removes
   the most common failure mode in the incident stories above.
4. **Lightweight production-change review.** Every incident story in section
   1 has the same shape: a config change skipped review, broke production,
   and took hours to trace. A simple "require confirm for production"
   gate, or an optional approver, is Doppler's Change Requests idea at a
   price a small team can pay.
5. **Guardrails, not just storage.** Startup validation against a
   .env.example contract, missing-variable detection before deploy, alerts
   on drift between local and production values. These are the failure
   modes teams hit weekly; none of the big platforms centers them.
6. **Flat, honest pricing.** Doppler charges $21/user/mo, Infisical
   $18/identity/mo; both punish growth in different ways (headcount vs
   machine identities). A flat team price is the wedge, same as the indie
   price point that worked for project 1.

**Positioning (one line):** "Git history for your env vars: every change
diffed, attributed, and one click away from rollback."

(Note on the project-2 value read from 2026-10-13: career asset 8/10,
purpose 7/10, business value 4/10, with the weak leg named plainly. Doppler,
Infisical, Vault, and AWS Secrets Manager own the enterprise space; this
project is worth building for portfolio credibility and the dev-tool craft,
not for the money.)

---

## 5. Risks & open questions

### Product risks
- **Storing other people's secrets is the highest-trust ask in the category.**
  Doppler's server-side custody is the standard complaint; a breach like
  Vercel's April 2026 OAuth compromise would be existential for a one-person
  tool. Encryption design (envelope encryption, client-held keys later) is a
  day-one architecture decision, not a feature. The MVP must at least encrypt
  at rest via the platform (Supabase) and never log values.
- **Sync integrations are the moat and the grind.** "Auto-sync to
  Vercel/Render/Supabase" is the differentiator over dotenvx, but each
  platform's API is its own integration to maintain, with token scopes and
  rate limits. Start with one (Vercel), prove the flow, then add the rest.
- **The incumbents are not standing still.** Doppler's Sept 2026 AI-agent
  push (MCP server, free machine identities) and Infisical's open-source
  velocity mean the feature floor rises fast. The wedge is the small-team
  price and the diff/rollback UX, not feature parity.
- **Envpilot is the closest direct competitor** (MIT, flat pricing, audit
  log, per-variable RBAC). Watch it; the differentiator has to be a better
  history/diff UX and the deploy-aware rollback, not the feature checklist.

### Technical risks
- **Encryption at rest vs. usability.** Values must be decryptable by the
  dashboard (to show diffs) and by sync jobs. Server-side decryption with
  Supabase as the store is the MVP answer; the upgrade path is per-project
  encryption keys (ponytail comment on that from day one).
- **History storage growth.** Every version of every secret is a row. The
  MVP answer: store full snapshots per version (simple, correct), cap
  retention (e.g. 90 days on the free plan), and note diffs as the upgrade
  path. Same tradeoff Infisical makes with paid point-in-time recovery.
- **Secret sprawl across paths.** UI, CLI, API, and sync jobs all mutate
  state; every one must write the audit entry. Miss one path and the audit
  log lies.

### What to validate in the MVP
- Can a 5-person team onboard in under 10 minutes: import .env, invite
  teammates, see their first diff?
- Does the diff view actually read better than `git log -p` on a SOPS file
  for the target user? (Test with one real team before polishing.)
- Does one-click rollback reliably restore a working production config,
  including the redeploy step, on a real Vercel project?
- Will a solo dev trust a hosted dashboard with their production secrets
  enough to try it? (Self-host story and the encryption explanation page
  carry this; validate the messaging early.)

**Open questions:** encryption model for v1 (Supabase-managed vs per-project
keys, and what the pricing page promises about it); which sync integration
first (Vercel is the obvious one: the audience deploys there and its env
model is best documented); whether to support folders/scopes in v1 (no:
flat per-environment namespaces, folders are the upgrade path); retention
limits on the free plan (90 days matches the category convention).
