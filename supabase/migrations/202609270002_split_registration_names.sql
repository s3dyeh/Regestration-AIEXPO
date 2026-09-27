-- Store names independently and retain all existing registration/contact data.
-- Apply after 202609270001. Exact database column names are "FNAME" and "LNAME".
begin;
lock table public.event_registrations in access exclusive mode;
alter table public.event_registrations add column if not exists "FNAME" text;
alter table public.event_registrations add column if not exists "LNAME" text;

-- Existing full names cannot reveal their original field boundaries. Keep the
-- first word in FNAME and the entire remainder in LNAME without truncation.
-- Historical single-word names keep an empty LNAME rather than inventing one.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_registrations' and column_name = 'name') then
    execute $backfill$
      update public.event_registrations
      set "FNAME" = coalesce("FNAME", split_part(regexp_replace(btrim(name), '\s+', ' ', 'g'), ' ', 1)),
          "LNAME" = coalesce("LNAME", regexp_replace(regexp_replace(btrim(name), '\s+', ' ', 'g'), '^[^ ]+ ?', ''))
      where "FNAME" is null or "LNAME" is null
    $backfill$;
  end if;
end;
$$;
alter table public.event_registrations alter column "FNAME" set not null;
alter table public.event_registrations alter column "LNAME" set not null;
alter table public.event_registrations drop constraint if exists event_registrations_split_names_check;
alter table public.event_registrations add constraint event_registrations_split_names_check
  check (char_length(btrim("FNAME")) between 1 and 100 and char_length("LNAME") <= 100
    and char_length(btrim("FNAME" || ' ' || "LNAME")) <= 100);

create or replace function public.registration_welcome(row_data public.event_registrations)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', row_data.id,
    'displayName', btrim(row_data."FNAME" || ' ' || row_data."LNAME"),
    'createdAt', row_data.created_at);
$$;

create or replace function public.submit_registration(target_event uuid, request_id uuid, details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.event_registrations;
  first_name text := coalesce(details->>'FNAME', details->>'firstName');
  last_name text := coalesce(details->>'LNAME', details->>'lastName');
  legacy_name text := regexp_replace(btrim(details->>'name'), '\s+', ' ', 'g');
  normalized_phone text := details->>'phone';
begin
  -- Support already-deployed older functions while the new function rolls out.
  if first_name is null and last_name is null and legacy_name is not null then
    first_name := split_part(legacy_name, ' ', 1);
    last_name := regexp_replace(legacy_name, '^[^ ]+ ?', '');
  end if;
  first_name := regexp_replace(btrim(first_name), '\s+', ' ', 'g');
  last_name := regexp_replace(btrim(last_name), '\s+', ' ', 'g');
  if normalized_phone ~ '^07[0-9]{8}$' then normalized_phone := '+962' || substr(normalized_phone, 2); end if;
  if first_name is null or first_name = '' or last_name is null or last_name = ''
     or char_length(first_name || ' ' || last_name) > 100
     or normalized_phone is null or normalized_phone !~ '^\+9627[0-9]{8}$' then
    raise exception 'Invalid registration name or phone' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into saved from public.event_registrations r where r.request_id = submit_registration.request_id;
  if found then
    if saved.event_id <> target_event
       or saved."FNAME" is distinct from first_name or saved."LNAME" is distinct from last_name
       or saved.email is distinct from details->>'email' or saved.phone is distinct from normalized_phone
       or saved.major is distinct from details->>'major' or saved.gender is distinct from details->>'gender' then
      raise exception 'request_conflict';
    end if;
    return public.registration_welcome(saved);
  end if;
  if not exists(select 1 from public.events where id = target_event and registration_open) then raise exception 'event_closed'; end if;
  insert into public.event_registrations(event_id, request_id, "FNAME", "LNAME", email, phone, major, gender, show_name)
  values(target_event, request_id, first_name, last_name, details->>'email', normalized_phone, details->>'major', details->>'gender', true)
  returning * into saved;
  return public.registration_welcome(saved);
end;
$$;
revoke all on function public.registration_welcome(public.event_registrations) from public, anon, authenticated;
revoke all on function public.submit_registration(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.submit_registration(uuid,uuid,jsonb) to service_role;

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
    select id, created_at, "FNAME", "LNAME", email, phone, major, gender from public.event_registrations
    where event_id = target_event order by created_at desc, id desc limit page_size offset page_number * page_size
  ) select jsonb_build_object(
    'total', (select count(*) from public.event_registrations where event_id = target_event),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'createdAt', created_at, 'firstName', "FNAME", 'lastName', "LNAME", 'email', email,
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
    'firstName', "FNAME", 'lastName', "LNAME", 'email', email, 'phone', phone, 'major', major, 'gender', gender, 'showName', show_name
  ) order by created_at, id) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_registrations(uuid,integer,integer) from public, anon;
revoke all on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) from public, anon;
grant execute on function public.admin_registrations(uuid,integer,integer) to authenticated;
grant execute on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) to authenticated;

-- Functions now refer only to split name columns; do not retain a duplicate name.
alter table public.event_registrations drop column if exists name;
revoke all on public.event_registrations from anon, authenticated;
notify pgrst, 'reload schema';
commit;
