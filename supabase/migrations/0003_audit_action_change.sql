-- 0003: the commit_version RPC writes audit_events.action = p_kind, and
-- p_kind can be 'change'. The 0001 check constraint did not list 'change',
-- so every ordinary write (set/edit/delete/bulk replace) aborted on a
-- check violation and rolled back. Add 'change' to the allowed actions.
-- 'create' comes from create_project, 'reveal'/'copy' from the reveal
-- route; 'update'/'delete' are reserved for future direct-key audit events.
alter table public.audit_events
  drop constraint if exists audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check
  check (action in ('create', 'change', 'update', 'delete', 'reveal', 'copy', 'rollback', 'import'));
