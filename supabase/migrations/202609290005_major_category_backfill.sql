begin;
create or replace function public.participant_major_category(major text)
returns text language sql immutable set search_path = '' as $$
  select case
    when normalized in ('', 'not provided') then 'Not Provided'
    when normalized in ('computer science', 'cs', 'software engineering', 'computer information systems', 'cis', 'computer science (virtual and augmented reality)', 'computer science (data science track)') then 'Computer Science and Information Technology'
    when normalized in ('artificial intelligence', 'ai', 'data science and artificial intelligence', 'data science', 'robotics and artificial intelligence', 'artificial intelligence and robotics engineering') then 'Artificial Intelligence, Data Science and Robotics'
    when normalized in ('cybersecurity', 'cyber security', 'information security', 'network and information security', 'network and information security engineering', 'computer networks and cybersecurity') then 'Cybersecurity and Network Security'
    when normalized in ('computer engineering', 'computer engineering (internet of things)', 'biomedical engineering', 'medical engineering', 'industrial engineering', 'electrical engineering', 'electrical engineering (network and systems security)', 'mechanical engineering', 'biomedical informatics engineering', 'smart and sustainable cities engineering', 'engineering') then 'Engineering'
    when normalized in ('business information technology', 'management information systems', 'business intelligence and data analytics', 'marketing', 'business', 'business administration', 'management', 'accounting') then 'Business and Management'
    when normalized in ('pharmacy', 'dentistry', 'medicine', 'nursing', 'speech and language pathology') then 'Health Sciences'
    when normalized in ('chemistry', 'science', 'physics', 'biology', 'mathematics') then 'Natural Sciences'
    when normalized in ('arts & humanities', 'arts and humanities', 'english', 'arabic') then 'Arts and Humanities'
    else 'Unclassified'
  end from (select regexp_replace(regexp_replace(lower(btrim(coalesce(major,''))), '\s+', ' ', 'g'), '[.]$', '') as normalized) normalized_major;
$$;
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
      public.participant_major_category(item->>'major'), coalesce(btrim(item->>'ieeeMembershipId'),''),
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
      ('universities',r.university_name),('roles',r.role),('majors',r.major),('majorCategories',public.participant_major_category(r.major)),
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

update public.event_registrations set major_category = public.participant_major_category(major);
notify pgrst, 'reload schema';
commit;
