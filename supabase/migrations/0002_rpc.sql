-- 0002: transactional mutation RPCs. Every write to env state goes through
-- commit_version, so there is no way to change state without writing the
-- audit row: version row + variable_states rows + audit row commit as one
-- unit or roll back together. SECURITY DEFINER, invoked with service_role.

-- p_changes: jsonb array of {key, value, deleted}. One version per call.
create or replace function public.commit_version(
  p_project_id uuid,
  p_env_name text,
  p_actor_id uuid,
  p_actor_email text,
  p_message text,
  p_kind text,
  p_changes jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_env_id uuid;
  v_seq bigint;
  v_version_id uuid;
  v_change jsonb;
begin
  if p_env_name not in ('dev', 'staging', 'prod') then
    raise exception 'invalid environment name' using errcode = '22023';
  end if;
  if p_kind not in ('change', 'rollback', 'import') then
    raise exception 'invalid version kind' using errcode = '22023';
  end if;

  -- the update both verifies the env belongs to the project and bumps the
  -- counter atomically, so concurrent writers serialize on this row
  update public.environments
     set version_seq = version_seq + 1
   where project_id = p_project_id and name = p_env_name
  returning id, version_seq into v_env_id, v_seq;
  if v_env_id is null then
    raise exception 'environment not found for project' using errcode = 'P0002';
  end if;

  insert into public.versions
    (project_id, environment_id, seq, actor_id, actor_email, message, kind)
  values
    (p_project_id, v_env_id, v_seq, p_actor_id, p_actor_email, p_message, p_kind)
  returning id into v_version_id;

  -- full snapshot: copy the previous head's states as the base
  insert into public.variable_states (version_id, key, value, deleted)
  select v_version_id, s.key, s.value, s.deleted
    from public.variable_states s
    join public.versions v on v.id = s.version_id
   where v.environment_id = v_env_id
     and v.seq = v_seq - 1;

  -- then apply this version's changes on top
  for v_change in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    if v_change ->> 'key' is null or btrim(v_change ->> 'key') = '' then
      raise exception 'change entry is missing key' using errcode = '22023';
    end if;
    insert into public.variable_states (version_id, key, value, deleted)
    values (
      v_version_id,
      v_change ->> 'key',
      v_change ->> 'value',
      coalesce((v_change ->> 'deleted')::boolean, false)
    )
    on conflict (version_id, key) do update
       set value = excluded.value,
           deleted = excluded.deleted;
  end loop;

  -- audit row inside the same transaction; a failed write aborts the mutation.
  -- never stores values, only the change count and the commit message.
  insert into public.audit_events
    (project_id, environment_id, actor_id, actor_email, action, details)
  values
    (p_project_id, v_env_id, p_actor_id, p_actor_email, p_kind,
     jsonb_build_object(
       'version_id', v_version_id,
       'seq', v_seq,
       'message', p_message,
       'change_count', jsonb_array_length(coalesce(p_changes, '[]'::jsonb))
     ));

  return v_version_id;
end;
$$;

-- one transaction: project + owner membership + the three environments.
-- a project is never half-seeded.
create or replace function public.create_project(
  p_name text,
  p_owner_id uuid,
  p_owner_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'project name is required' using errcode = '22023';
  end if;

  insert into public.projects (name, created_by)
  values (btrim(p_name), p_owner_id)
  returning id into v_project_id;

  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, p_owner_id, 'owner');

  insert into public.environments (project_id, name)
  values
    (v_project_id, 'dev'),
    (v_project_id, 'staging'),
    (v_project_id, 'prod');

  insert into public.audit_events
    (project_id, actor_id, actor_email, action, details)
  values
    (v_project_id, p_owner_id, p_owner_email, 'create',
     jsonb_build_object('seeded_environments', array['dev', 'staging', 'prod']));

  return v_project_id;
end;
$$;

-- execute goes to service_role only; the API layer owns the membership check.
grant execute on function public.commit_version(uuid, text, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.create_project(text, uuid, text) to service_role;
