-- Existing participants are preserved; attendance starts unmarked.
begin;
lock table public.event_registrations in access exclusive mode;
drop trigger if exists registration_committed on public.event_registrations;
drop function if exists public.submit_registration(uuid,uuid,jsonb);
drop function if exists public.event_attendees(uuid,text,text,integer,integer);
alter table public.event_registrations add column full_name text;
update public.event_registrations set full_name = btrim("FNAME" || ' ' || "LNAME");
alter table public.event_registrations alter column full_name set not null;
alter table public.event_registrations add constraint full_name_length check (char_length(btrim(full_name)) between 1 and 100);
alter table public.event_registrations add column participant_id text;
update public.event_registrations set participant_id = id::text;
alter table public.event_registrations alter column participant_id set not null;
alter table public.event_registrations add constraint participant_id_length check (char_length(btrim(participant_id)) between 1 and 100);
alter table public.event_registrations add constraint participant_event_unique unique(event_id, participant_id);
alter table public.event_registrations add column is_ieee_member boolean not null default false;
alter table public.event_registrations add column role text not null default '';
alter table public.event_registrations add column university_name text not null default '';
alter table public.event_registrations add column attended_at timestamptz;
alter table public.event_registrations drop constraint event_registrations_phone_check;
alter table public.event_registrations drop constraint event_registrations_major_check;
alter table public.event_registrations drop constraint event_registrations_gender_check;
alter table public.event_registrations drop constraint event_registrations_event_id_email_key;
alter table public.event_registrations add constraint contact_lengths check (
  char_length(phone) between 1 and 40 and char_length(major) between 1 and 200
  and char_length(gender) between 1 and 100 and char_length(role) <= 100 and char_length(university_name) <= 200);
create table public.attendance_scans (
  request_id uuid primary key, event_id uuid not null references public.events(id),
  participant_id text not null, result jsonb not null
);
alter table public.attendance_scans enable row level security;
revoke all on public.attendance_scans from anon, authenticated;

create or replace function public.registration_welcome(row_data public.event_registrations)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', row_data.id, 'displayName', row_data.full_name,
    'createdAt', coalesce(row_data.attended_at, row_data.created_at));
$$;

create function public.import_participants(target_event uuid, participants jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; total integer;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(participants) is distinct from 'array' then raise exception 'Expected participants array' using errcode = '22023'; end if;
  total := jsonb_array_length(participants);
  if total < 1 or total > 10000 then raise exception 'Import 1 to 10000 participants at a time' using errcode = '22023'; end if;
  if exists(select 1 from jsonb_array_elements(participants) p group by btrim(p->>'participantId') having count(*) > 1) then
    raise exception 'Duplicate IDs in import' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(participants) loop
    if exists(select 1 from unnest(array['participantId','fullName','email','phone','role','universityName','major','gender']) k
      where jsonb_typeof(item->k) is distinct from 'string' or btrim(item->>k) = '')
      or jsonb_typeof(item->'isIeeeMember') is distinct from 'boolean'
      or (item->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'Invalid participant details' using errcode = '22023';
    end if;
    insert into public.event_registrations(event_id, request_id, participant_id, full_name, email, phone, is_ieee_member, role, university_name, major, gender, show_name)
    values(target_event, gen_random_uuid(), btrim(item->>'participantId'), btrim(item->>'fullName'), lower(btrim(item->>'email')),
      btrim(item->>'phone'), (item->>'isIeeeMember')::boolean, btrim(item->>'role'), btrim(item->>'universityName'), btrim(item->>'major'), btrim(item->>'gender'), true)
    on conflict(event_id, participant_id) do update set full_name = excluded.full_name, email = excluded.email,
      phone = excluded.phone, is_ieee_member = excluded.is_ieee_member, role = excluded.role,
      university_name = excluded.university_name, major = excluded.major, gender = excluded.gender;
  end loop;
  return total;
end;
$$;
revoke all on function public.import_participants(uuid,jsonb) from public, anon;
grant execute on function public.import_participants(uuid,jsonb) to authenticated;

create function public.check_in_attendance(target_event uuid, request_id uuid, participant_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.event_registrations; previous public.attendance_scans; result jsonb; already boolean;
begin
  if participant_id is null or char_length(btrim(participant_id)) not between 1 and 100 then raise exception 'Invalid ID' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into previous from public.attendance_scans s where s.request_id = check_in_attendance.request_id;
  if found then
    if previous.event_id <> target_event or previous.participant_id <> btrim(check_in_attendance.participant_id) then raise exception 'request_conflict'; end if;
    return previous.result;
  end if;
  if not exists(select 1 from public.events where id = target_event and registration_open) then raise exception 'event_closed'; end if;
  select * into saved from public.event_registrations r where r.event_id = target_event
    and r.participant_id = btrim(check_in_attendance.participant_id) for update;
  if not found then raise exception 'participant_not_found'; end if;
  already := saved.attended_at is not null;
  if not already then
    update public.event_registrations set attended_at = clock_timestamp() where id = saved.id returning * into saved;
  end if;
  -- Each deliberate scan has a new welcome ID; retrying a request reuses its result.
  result := jsonb_build_object('id', request_id, 'displayName', saved.full_name, 'createdAt', clock_timestamp(), 'alreadyAttended', already);
  insert into public.attendance_scans values(request_id, target_event, btrim(participant_id), result);
  perform realtime.send(result, 'registration', 'event:' || target_event::text, true);
  return result;
end;
$$;
revoke all on function public.check_in_attendance(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.check_in_attendance(uuid,uuid,text) to service_role;
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
    select * from public.event_registrations
    where event_id = target_event order by created_at desc, id desc limit page_size offset page_number * page_size
  ) select jsonb_build_object(
    'total', (select count(*) from public.event_registrations where event_id = target_event),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'createdAt', created_at, 'fullName', full_name, 'participantId', participant_id, 'isIeeeMember', is_ieee_member, 'role', role, 'universityName', university_name, 'attendedAt', attended_at, 'email', email,
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
    'fullName', full_name, 'participantId', participant_id, 'isIeeeMember', is_ieee_member, 'role', role, 'universityName', university_name, 'attendedAt', attended_at, 'email', email, 'phone', phone, 'major', major, 'gender', gender, 'showName', show_name
  ) order by created_at, id) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_registrations(uuid,integer,integer) from public, anon;
revoke all on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) from public, anon;
grant execute on function public.admin_registrations(uuid,integer,integer) to authenticated;
grant execute on function public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid) to authenticated;

create or replace function public.event_statistics(target_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  with registrations as (select * from public.event_registrations where event_id = target_event and attended_at is not null),
  majors as (select major as name, count(*) as count from registrations group by major),
  genders as (select gender as name, count(*) as count from registrations group by gender),
  timeline as (select date_trunc('hour', attended_at) as time, count(*) as count from registrations group by 1),
  recent as (select * from public.event_registrations where event_id = target_event and attended_at is not null order by attended_at desc, id desc limit 6)
  select jsonb_build_object(
    'total', (select count(*) from registrations),
    'recentCount', (select count(*) from registrations where attended_at >= now() - interval '1 hour'),
    'recent', coalesce((select jsonb_agg(public.registration_welcome(recent::public.event_registrations) order by attended_at desc, id desc) from recent), '[]'::jsonb),
    'majors', coalesce((select jsonb_agg(to_jsonb(majors) order by name) from majors), '[]'::jsonb),
    'genders', coalesce((select jsonb_agg(to_jsonb(genders) order by name) from genders), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(to_jsonb(timeline) order by time) from timeline), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

alter table public.event_registrations drop column "FNAME", drop column "LNAME";
notify pgrst, 'reload schema';
commit;
