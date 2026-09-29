begin;
insert into auth.users values ('11111111-1111-4111-a111-111111111111');
insert into public.event_operators values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1','11111111-1111-4111-a111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',true);
do $$
declare e uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; payload jsonb := '[
{"participantId":"001","fullName":"Confirmed Member","email":"shared@example.com","isIeeeMember":true,"role":"Graduate","universityName":"UJ","major":"AI","gender":"Not Provided","majorCategory":"Computing","referralSource":"Friends","dataQualityNotes":"Check source"},
{"participantId":"002","fullName":"Different Person","email":"shared@example.com","isIeeeMember":false,"role":"Graduate","universityName":"JUST","major":"Engineering","gender":"Female","majorCategory":"Engineering","referralSource":"University"}]'; stats jsonb; dimension jsonb; before_row jsonb;
begin
  assert public.import_participants(e,payload)=2;
  assert public.import_participants(e,payload)=0;
  perform public.check_in_attendance(e,gen_random_uuid(),'001');
  before_row := public.admin_registrations(e)->'rows'->0;
  assert public.import_participants(e,jsonb_set(payload,'{0,fullName}','"Overwrite attempt"'))=0;
  assert public.admin_registrations(e)->'rows'->0 = before_row, 'Import must preserve the complete existing profile and attendance';
  assert not (public.admin_registrations(e)->'rows'->0 ? 'phone');
  assert not (public.admin_registration_export_page(e)->'rows'->0 ? 'phone');
  stats := public.event_statistics(e);
  assert (stats->>'total')::int=1;
  assert (stats->'audience'->>'registeredTotal')::int=2;
  assert (stats->'audience'->>'flaggedRecords')::int=1;
  assert (stats->'audience'->>'registeredMembers')::int=1;
  for dimension in select value from jsonb_each(stats->'audience'->'dimensions') loop
    assert (select sum((v->>'registered')::int) from jsonb_array_elements(dimension) v)=2;
    assert (select sum((v->>'attended')::int) from jsonb_array_elements(dimension) v)=1;
  end loop;
  assert not (stats ? 'genders');
  assert not (stats->'audience'->'dimensions' ? 'genders');
  assert public.admin_registration_export_page(e)->'rows'->0->>'majorCategory'='Artificial Intelligence, Data Science and Robotics';
  assert public.admin_registration_export_page(e)->'rows'->0->>'referralSource'='Friends';
  assert public.admin_registrations(e)->'rows'->0->>'dataQualityNotes'='Check source';
  assert not (stats::text like '%shared@example.com%'), 'Aggregate dashboard must not expose contact data';
  perform public.check_in_attendance(e,gen_random_uuid(),'001');
  assert public.event_statistics(e)->>'total'='1';
end;
$$;
rollback;
