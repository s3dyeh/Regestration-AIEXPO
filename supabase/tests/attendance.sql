begin;
insert into auth.users values ('11111111-1111-4111-a111-111111111111');
insert into public.event_operators values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1','11111111-1111-4111-a111-111111111111');
set local role authenticated;
do $$
declare e uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; rows jsonb := '[{"participantId":"001","fullName":"Lina Noor Omar","email":"lina@example.com","isIeeeMember":true,"role":"Student","universityName":"UJ","major":"AI","gender":"Female"}]';
begin
  assert not has_function_privilege('anon', 'public.import_participants(uuid,jsonb)', 'execute');
  assert not has_function_privilege('anon', 'public.check_in_attendance(uuid,uuid,text)', 'execute');
  begin perform public.check_in_attendance(e,gen_random_uuid(),'001'); raise exception 'Expected unauthorized check-in'; exception when insufficient_privilege then null; end;
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'select');
  begin perform public.import_participants(e,rows); raise exception 'Expected unauthorized'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',true);
  assert public.import_participants(e,rows) = 1;
  assert (public.event_statistics(e)->>'total')::int = 0;
  assert jsonb_array_length(public.admin_registrations(e)->'rows') = 0, 'Imported participants must not appear before check-in';
  assert jsonb_array_length(public.admin_registration_export_page(e)->'rows') = 0, 'Exports must exclude absent participants';
  begin perform public.import_participants(e, rows || rows); raise exception 'Expected duplicate failure'; exception when invalid_parameter_value then null; end;
  begin perform public.import_participants(e, rows || '[{"participantId":"bad"}]'::jsonb); raise exception 'Expected atomic validation'; exception when invalid_parameter_value then null; end;
  assert (public.admin_registrations(e)->>'total')::int = 0;
end;
$$;
reset role;
set local role authenticated;
do $$
declare e uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; r uuid := gen_random_uuid(); a jsonb; b jsonb;
begin
  a := public.check_in_attendance(e,r,'001');
  assert (a->>'alreadyAttended')::boolean = false;
  assert a->>'displayName' = 'Lina Noor Omar';
  assert not (a ? 'email');
  assert public.check_in_attendance(e,r,'001') = a;
  b := public.check_in_attendance(e,gen_random_uuid(),'001');
  assert (b->>'alreadyAttended')::boolean = true;
  assert (public.event_statistics(e)->>'ieeeMembers')::int = 1, 'Repeated check-ins must not double count membership';
  assert public.event_statistics(e)->'roles' = '[{"name":"Student","count":1}]'::jsonb;
  assert b->>'id' <> a->>'id';
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-a222-222222222222',true);
  begin perform public.check_in_attendance(e,r,'001'); raise exception 'Expected unauthorized replay'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',true);
  begin perform public.check_in_attendance(e,r,'other'); raise exception 'Expected conflict'; exception when raise_exception then assert sqlerrm = 'request_conflict'; end;
  begin perform public.check_in_attendance(e,gen_random_uuid(),'missing'); raise exception 'Expected unknown ID'; exception when raise_exception then assert sqlerrm = 'participant_not_found'; end;
end;
$$;
reset role;
do $$
begin
  assert (select count(*) from public.event_registrations where attended_at is not null) = 1;
  assert (select count(*) from realtime.messages) = 3, 'One roster notification and two deliberate scan notifications';
end;
$$;
set local role authenticated;
do $$
declare e uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; original text;
begin
  original := public.admin_registrations(e)->'rows'->0->>'attendedAt';
  assert public.import_participants(e,'[{"participantId":"001","fullName":"Updated Name","email":"new@example.com","isIeeeMember":false,"role":"Guest","universityName":"UJ","major":"AI","gender":"Female"}]') = 0, 'Existing IDs must be skipped';
  perform public.import_participants(e,'[{"participantId":"002","fullName":"Absent Person","email":"absent@example.com","isIeeeMember":false,"role":"Guest","universityName":"UJ","major":"AI","gender":"Female"}]');
  assert (public.admin_registrations(e)->>'total')::int = 1, 'Absent participant must not change attendance count';
  assert jsonb_array_length(public.admin_registration_export_page(e)->'rows') = 1, 'Absent participant must not be exported';
  assert public.admin_registrations(e)->'rows'->0->>'attendedAt' = original;
  assert (public.event_statistics(e)->>'total')::int = 1;
  assert public.event_statistics(e)->'recent'->0->>'displayName' = 'Lina Noor Omar';
  assert (public.event_statistics(e)->>'ieeeMembers')::int = 1;
  assert public.event_statistics(e)->'universities' = '[{"name":"UJ","count":1}]'::jsonb;
  assert public.event_statistics(e)->'roles' = '[{"name":"Student","count":1}]'::jsonb;
  assert public.admin_registration_export_page(e)->'rows'->0->>'fullName' = 'Lina Noor Omar';
  assert public.admin_registration_export_page(e)->'rows'->0->>'participantId' = '001';
end;
$$;
rollback;
