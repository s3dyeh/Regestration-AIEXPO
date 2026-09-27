-- Read-only contact access is restricted to operators assigned to this event.
begin;
create index if not exists event_registrations_export_order
  on public.event_registrations(event_id, created_at, id);

create or replace function public.admin_registrations(target_event uuid, page_number integer default 0, page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if page_number is null or page_size is null or page_number < 0 or page_number > 100000 or page_size not in (10,25,50,100) then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;
  with page as (
    select id, created_at, name, email, phone, major, gender from public.event_registrations
    where event_id = target_event order by created_at desc, id desc limit page_size offset page_number * page_size
  ) select jsonb_build_object(
    'total', (select count(*) from public.event_registrations where event_id = target_event),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'createdAt', created_at, 'name', name, 'email', email,
      'phone', phone, 'major', major, 'gender', gender
    ) order by created_at desc, id desc) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Keyset batches avoid duplicate rows when new registrations arrive during export.
-- The first call chooses a database timestamp; every following call reuses it.
create or replace function public.admin_registration_export_page(
  target_event uuid, export_before timestamptz default null,
  after_created_at timestamptz default null, after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; cutoff timestamptz := coalesce(export_before, statement_timestamp());
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if (after_created_at is null) <> (after_id is null) then
    raise exception 'Invalid cursor' using errcode = '22023';
  end if;
  with page as (
    select * from public.event_registrations where event_id = target_event and created_at <= cutoff
    and (after_id is null or (created_at, id) > (after_created_at, after_id))
    order by created_at, id limit 500
  ) select jsonb_build_object('cutoff', cutoff, 'rows', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'eventId', event_id, 'requestId', request_id, 'createdAt', created_at,
    'name', name, 'email', email, 'phone', phone, 'major', major, 'gender', gender, 'showName', show_name
  ) order by created_at, id) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_registrations(uuid,integer,integer) from public, anon;
revoke all on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) from public, anon;
grant execute on function public.admin_registrations(uuid,integer,integer) to authenticated;
grant execute on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) to authenticated;
-- No direct table reads or writes are added by the admin feature.
revoke all on public.event_registrations from anon, authenticated;
commit;
