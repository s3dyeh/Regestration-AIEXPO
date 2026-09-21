-- Always greet by full name and remove contact-table access from the application.
-- Apply after 003. Safe to re-run; no registrations are deleted or rewritten.
begin;

create or replace function public.registration_welcome(row_data public.event_registrations)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', row_data.id,
    'displayName', row_data.name,
    'createdAt', row_data.created_at
  );
$$;
revoke all on function public.registration_welcome(public.event_registrations) from public, anon, authenticated;

-- Remove the RPC itself, so the removed desk cannot be accessed by calling its API.
drop function if exists public.event_attendees(uuid, text, text, integer, integer);
revoke all on public.event_registrations from anon, authenticated;

commit;
