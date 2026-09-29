begin;
create or replace function public.event_statistics(target_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  with registrations as (select * from public.event_registrations where event_id = target_event and attended_at is not null),
  majors as (select major as name, count(*) as count from registrations group by major),
  genders as (select gender as name, count(*) as count from registrations group by gender),
  universities as (select coalesce(nullif(btrim(university_name), ''), 'Not Provided') as name, count(*) as count from registrations group by 1),
  roles as (select coalesce(nullif(btrim(role), ''), 'Not Provided') as name, count(*) as count from registrations group by 1),
  timeline as (select date_trunc('hour', attended_at) as time, count(*) as count from registrations group by 1),
  recent as (select * from public.event_registrations where event_id = target_event and attended_at is not null order by attended_at desc, id desc limit 6)
  select jsonb_build_object(
    'total', (select count(*) from registrations),
    'ieeeMembers', (select count(*) from registrations where is_ieee_member),
    'universities', coalesce((select jsonb_agg(to_jsonb(universities) order by count desc, name) from universities), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(to_jsonb(roles) order by count desc, name) from roles), '[]'::jsonb),
    'recentCount', (select count(*) from registrations where attended_at >= now() - interval '1 hour'),
    'recent', coalesce((select jsonb_agg(public.registration_welcome(recent::public.event_registrations) order by attended_at desc, id desc) from recent), '[]'::jsonb),
    'majors', coalesce((select jsonb_agg(to_jsonb(majors) order by name) from majors), '[]'::jsonb),
    'genders', coalesce((select jsonb_agg(to_jsonb(genders) order by name) from genders), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(to_jsonb(timeline) order by time) from timeline), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
notify pgrst, 'reload schema';
commit;
