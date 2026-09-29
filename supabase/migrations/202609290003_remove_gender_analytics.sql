begin;
-- Remove analytics only; preserve existing participant data and import compatibility.
create or replace function public.event_statistics(target_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  with roster as materialized (select * from public.event_registrations where event_id = target_event),
  dimensional as (
    select v.dimension, coalesce(nullif(btrim(v.name),''),'Not Provided') as name,
      count(*) as registered, count(*) filter(where r.attended_at is not null) as attended,
      count(*) filter(where r.is_ieee_member) as "registeredMembers",
      count(*) filter(where r.is_ieee_member and r.attended_at is not null) as members
    from roster r cross join lateral (values
      ('universities',r.university_name),('roles',r.role),('majors',r.major),('majorCategories',r.major_category),
      ('referrals',r.referral_source),('organizations',r.organization_name)) v(dimension,name)
    group by 1,2
  ),
  grouped as (select dimension, jsonb_agg(jsonb_build_object('name',name,'registered',registered,'attended',attended,'registeredMembers',"registeredMembers",'members',members) order by registered desc,name) as rows from dimensional group by dimension),
  recent as (select * from roster where attended_at is not null order by attended_at desc,id desc limit 6)
  select jsonb_build_object(
    'total',(select count(*) from roster where attended_at is not null),
    'ieeeMembers',(select count(*) from roster where attended_at is not null and is_ieee_member),
    'audience',jsonb_build_object(
      'registeredTotal',(select count(*) from roster),
      'registeredMembers',(select count(*) from roster where is_ieee_member),
      'flaggedRecords',(select count(*) from roster where btrim(data_quality_notes) <> ''),
      'dimensions',(select jsonb_object_agg(d,coalesce(g.rows,'[]'::jsonb)) from unnest(array['universities','roles','majors','majorCategories','referrals','organizations']) d left join grouped g on g.dimension=d)
    ),
    'universities',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',attended) order by name) from dimensional where dimension='universities' and attended>0),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',attended) order by name) from dimensional where dimension='roles' and attended>0),'[]'::jsonb),
    'majors',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',attended) order by name) from dimensional where dimension='majors' and attended>0),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(public.registration_welcome(recent::public.event_registrations) order by attended_at desc,id desc) from recent),'[]'::jsonb),
    'timeline','[]'::jsonb,'recentCount',0
  ) into result;
  return result;
end;
$$;
notify pgrst, 'reload schema';
commit;
