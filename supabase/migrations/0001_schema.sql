-- 0001: core schema. Append-only versioning for env vars.
-- RLS is enabled on every table with NO policies (default deny for
-- anon/authenticated); all access goes through the service_role key plus the
-- requireMembership gate in the API routes.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deploy_target text not null default 'none'
    check (deploy_target in ('vercel', 'render', 'supabase', 'none')),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null
    check (name in ('dev', 'staging', 'prod')),
  version_seq bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  environment_id uuid not null references public.environments (id) on delete cascade,
  seq bigint not null,
  actor_id uuid not null,
  actor_email text not null,
  message text not null,
  kind text not null default 'change'
    check (kind in ('change', 'rollback', 'import')),
  created_at timestamptz not null default now(),
  -- per-environment monotonic sequence; "latest" is max seq, never a timestamp tie
  unique (environment_id, seq)
);

create table public.variable_states (
  version_id uuid not null references public.versions (id) on delete cascade,
  key text not null,
  value text,
  deleted boolean not null default false,
  primary key (version_id, key)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  environment_id uuid references public.environments (id) on delete cascade,
  actor_id uuid not null,
  actor_email text not null,
  action text not null
    check (action in ('create', 'change', 'update', 'delete', 'reveal', 'copy', 'rollback', 'import')),
  target_key text,
  -- never contains values, only ids, counts, and messages
  details jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);

-- current state is derived: the highest-seq version's states, one query
create index versions_env_seq_idx on public.versions (environment_id, seq desc);
create index variable_states_version_idx on public.variable_states (version_id);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.environments enable row level security;
alter table public.versions enable row level security;
alter table public.variable_states enable row level security;
alter table public.audit_events enable row level security;

-- explicit minimal grants: service_role bypasses RLS but not grants, and
-- Supabase ends automatic grants on new public tables on 2026-10-30, so a
-- missing grant fails with 42501. Never grant to anon or authenticated.
grant select, insert, update, delete on public.projects to service_role;
grant select, insert, update, delete on public.project_members to service_role;
grant select, insert, update, delete on public.environments to service_role;
grant select, insert, update, delete on public.versions to service_role;
grant select, insert, update, delete on public.variable_states to service_role;
grant select, insert, update, delete on public.audit_events to service_role;
