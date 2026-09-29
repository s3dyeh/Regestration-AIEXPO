begin;
insert into auth.users values ('11111111-1111-4111-a111-111111111111');
insert into public.event_operators values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1','11111111-1111-4111-a111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-a222-222222222222',true);
do $$ begin
  begin perform public.reset_event_attendance('a1c08e5d-0817-4684-a03e-1b37c24e1aa1',true); raise exception 'Unauthorized reset succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',true);
do $$
declare e uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; scan uuid := gen_random_uuid(); before_row jsonb;
begin
  perform public.import_participants(e,'[{"participantId":"001","fullName":"Reset Test","email":"reset@example.com","isIeeeMember":true,"role":"Student","universityName":"UJ","major":"AI","gender":"Not Provided"}]');
  perform public.check_in_attendance(e,scan,'001');
  before_row := (public.admin_registrations(e)->'rows'->0) - 'attendedAt';
  begin perform public.reset_event_attendance(e,false); raise exception 'Unconfirmed reset succeeded';
  exception when invalid_parameter_value then null; end;
  assert public.event_statistics(e)->>'total' = '1';
  assert public.reset_event_attendance(e,true) = 1;
  assert public.event_statistics(e)->>'total' = '0';
  assert public.event_statistics(e)->'audience'->>'registeredTotal' = '1';
  assert public.admin_registrations(e)->>'total' = '0';
  assert public.admin_registration_export_page(e)->'rows' = '[]'::jsonb;
  assert public.reset_event_attendance(e,true) = 0;
  -- A previously used request must record a new attendance after its scan history is cleared.
  assert public.check_in_attendance(e,scan,'001')->>'alreadyAttended' = 'false';
  assert public.event_statistics(e)->>'total' = '1';
  assert (public.admin_registrations(e)->'rows'->0) - 'attendedAt' = before_row;
end $$;
rollback;
