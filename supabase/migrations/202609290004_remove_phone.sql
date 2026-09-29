-- Remove phone collection, API output and stored phone values. Apply with the updated frontend/export function.
begin;
create or replace function public.import_participants(target_event uuid, participants jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; total integer; inserted integer := 0; affected integer;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(participants) is distinct from 'array' then raise exception 'Expected participants array' using errcode = '22023'; end if;
  total := jsonb_array_length(participants);
  if total < 1 or total > 10000 then raise exception 'Import 1 to 10000 participants' using errcode = '22023'; end if;
  if exists(select 1 from jsonb_array_elements(participants) p group by btrim(p->>'participantId') having count(*) > 1) then
    raise exception 'Duplicate IDs in import' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(participants) loop
    if exists(select 1 from unnest(array['participantId','fullName','email','role','universityName','major','gender']) k
      where jsonb_typeof(item->k) is distinct from 'string' or btrim(item->>k) = '')
      or jsonb_typeof(item->'isIeeeMember') is distinct from 'boolean'
      or (item->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or exists(select 1 from unnest(array['majorCategory','ieeeMembershipId','organizationName','position','referralSource','dataQualityNotes']) k
        where item ? k and jsonb_typeof(item->k) is distinct from 'string') then
      raise exception 'Invalid participant details' using errcode = '22023';
    end if;
    insert into public.event_registrations(event_id, request_id, participant_id, full_name, email, is_ieee_member, role, university_name, major, gender, show_name,
      major_category, ieee_membership_id, organization_name, position, referral_source, data_quality_notes)
    values(target_event, gen_random_uuid(), btrim(item->>'participantId'), btrim(item->>'fullName'), lower(btrim(item->>'email')),
      (item->>'isIeeeMember')::boolean, btrim(item->>'role'), btrim(item->>'universityName'), btrim(item->>'major'), btrim(item->>'gender'), true,
      coalesce(nullif(btrim(item->>'majorCategory'),''),'Not Provided'), coalesce(btrim(item->>'ieeeMembershipId'),''),
      coalesce(nullif(btrim(item->>'organizationName'),''),'Not Provided'), coalesce(btrim(item->>'position'),''),
      coalesce(nullif(btrim(item->>'referralSource'),''),'Not Provided'), coalesce(btrim(item->>'dataQualityNotes'),''))
    on conflict(event_id, participant_id) do nothing;
    get diagnostics affected = row_count;
    inserted := inserted + affected;
  end loop;
  if inserted > 0 then
    perform realtime.send(jsonb_build_object('changed',true), 'roster_changed', 'event:' || target_event::text, true);
  end if;
  return inserted;
end;
$$;

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
    where event_id = target_event and attended_at is not null order by attended_at desc, id desc limit page_size offset page_number * page_size
  ) select jsonb_build_object(
    'total', (select count(*) from public.event_registrations where event_id = target_event and attended_at is not null),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'createdAt', created_at, 'fullName', full_name, 'participantId', participant_id, 'isIeeeMember', is_ieee_member, 'role', role, 'universityName', university_name, 'attendedAt', attended_at, 'email', email,
      'majorCategory', major_category, 'ieeeMembershipId', ieee_membership_id, 'organizationName', organization_name, 'position', position, 'referralSource', referral_source, 'dataQualityNotes', data_quality_notes, 'major', major, 'gender', gender
    ) order by attended_at desc, id desc) from page), '[]'::jsonb)
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
    select * from public.event_registrations where event_id = target_event and attended_at is not null and created_at <= cutoff
    and (after_id is null or (created_at, id) > (after_created_at, after_id))
    order by created_at, id limit 500
  ) select jsonb_build_object('cutoff', cutoff, 'rows', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'eventId', event_id, 'requestId', request_id, 'createdAt', created_at,
    'fullName', full_name, 'participantId', participant_id, 'isIeeeMember', is_ieee_member, 'role', role, 'universityName', university_name, 'attendedAt', attended_at, 'email', email, 'majorCategory', major_category, 'ieeeMembershipId', ieee_membership_id, 'organizationName', organization_name, 'position', position, 'referralSource', referral_source, 'dataQualityNotes', data_quality_notes, 'major', major, 'gender', gender, 'showName', show_name
  ) order by created_at, id) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;
alter table public.event_registrations drop constraint contact_lengths;
alter table public.event_registrations add constraint participant_detail_lengths check (
  char_length(major) between 1 and 200 and char_length(gender) between 1 and 100
  and char_length(role) <= 100 and char_length(university_name) <= 200);
alter table public.event_registrations drop column phone;
notify pgrst, 'reload schema';
commit;
