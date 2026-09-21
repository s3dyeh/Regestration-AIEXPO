-- AI EXPO 2026: dashboard additions only. Run after migrations 001 and 002.
-- Reuses existing tables, email uniqueness, welcome privacy and the 20/minute IP limiter.
-- No new tables, queues, extra rate limiter or registration changes.
-- Safe to re-run; existing registrations are not modified.
begin;

create or replace function public.event_attendees(target_event uuid, search_term text default '', major_filter text default '', page_number integer default 0, page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if page_number is null or page_size is null or search_term is null or major_filter is null
     or page_number < 0 or page_number > 100000 or page_size < 1 or page_size > 500 or char_length(search_term) > 254 then raise exception 'Invalid pagination'; end if;
  with filtered as (
    select * from public.event_registrations where event_id = target_event
    and (major_filter = '' or major = major_filter)
    and (search_term = '' or strpos(lower(name || ' ' || email || ' ' || phone), lower(search_term)) > 0)
  ), page as (
    select * from filtered order by created_at desc, id desc limit page_size offset page_number * page_size
  ) select jsonb_build_object('total', (select count(*) from filtered), 'rows', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'registration', jsonb_build_object('name', name, 'email', email, 'phone', phone, 'major', major, 'gender', gender, 'showName', show_name)
  ) order by created_at desc, id desc) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.event_attendees(uuid,text,text,integer,integer) from public, anon;
grant execute on function public.event_attendees(uuid,text,text,integer,integer) to authenticated;

create or replace function public.event_statistics(target_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  with registrations as (select * from public.event_registrations where event_id = target_event),
  majors as (select major as name, count(*) as count from registrations group by major),
  genders as (select gender as name, count(*) as count from registrations group by gender),
  timeline as (select date_trunc('hour', created_at) as time, count(*) as count from registrations group by 1),
  recent as (select * from public.event_registrations where event_id = target_event order by created_at desc, id desc limit 6)
  select jsonb_build_object(
    'total', (select count(*) from registrations),
    'recentCount', (select count(*) from registrations where created_at >= now() - interval '1 hour'),
    'recent', coalesce((select jsonb_agg(public.registration_welcome(recent::public.event_registrations) order by created_at desc, id desc) from recent), '[]'::jsonb),
    'majors', coalesce((select jsonb_agg(to_jsonb(majors) order by name) from majors), '[]'::jsonb),
    'genders', coalesce((select jsonb_agg(to_jsonb(genders) order by name) from genders), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(to_jsonb(timeline) order by time) from timeline), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Keep both dashboard functions private to authenticated event operators.
revoke all on function public.event_statistics(uuid) from public, anon;
grant execute on function public.event_statistics(uuid) to authenticated;

commit;
