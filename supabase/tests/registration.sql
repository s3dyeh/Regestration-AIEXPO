\set ON_ERROR_STOP on
begin;
do $$
declare
  event_id uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1';
  request_id uuid := gen_random_uuid();
  details jsonb := '{"name":"Lina Omar","email":"lina@example.com","phone":"+962791234567","major":"Computer Science","gender":"Female","showName":true}';
  first_result jsonb;
  second_result jsonb;
  snapshot jsonb;
begin
  first_result := public.submit_registration(event_id, request_id, details);
  second_result := public.submit_registration(event_id, request_id, details);
  assert first_result = second_result, 'Idempotent retry must return the original record';
  assert (select count(*) from public.event_registrations) = 1, 'Retry must not insert';
  assert (select count(*) from realtime.messages) = 1, 'Retry must not broadcast twice';
  assert not (first_result ? 'email') and not (first_result ? 'phone'), 'Welcome must not leak contact data';
  assert first_result->>'displayName' = 'Lina Omar', 'Display name must be full name';
  begin
    perform public.submit_registration(event_id, gen_random_uuid(), details);
    raise exception 'Expected duplicate to fail';
  exception when unique_violation then null;
  end;
  begin
    perform public.submit_registration(event_id, request_id, details || '{"name":"Other Name"}');
    raise exception 'Expected changed retry to fail';
  exception when raise_exception then
    if sqlerrm <> 'request_conflict' then raise; end if;
  end;
  second_result := public.submit_registration(event_id, gen_random_uuid(), details || '{"email":"private@example.com","showName":false}');
  assert second_result->>'displayName' = 'Lina Omar', 'Legacy flags cannot suppress full-name greetings';
  assert not has_table_privilege('anon', 'public.event_registrations', 'SELECT'), 'Anonymous contact access forbidden';
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'SELECT'), 'Operators cannot fetch contact rows';
  assert not has_function_privilege('anon', 'public.submit_registration(uuid,uuid,jsonb)', 'EXECUTE'), 'Direct anonymous writes forbidden';
  assert not has_function_privilege('authenticated', 'public.submit_registration(uuid,uuid,jsonb)', 'EXECUTE'), 'Direct authenticated writes forbidden';
  begin
    perform public.event_statistics(event_id);
    raise exception 'Expected unauthorized statistics to fail';
  exception when insufficient_privilege then null;
  end;
  insert into auth.users values ('11111111-1111-4111-a111-111111111111');
  insert into public.event_operators values (event_id, '11111111-1111-4111-a111-111111111111');
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', true);
  snapshot := public.event_statistics(event_id);
  assert (snapshot->>'total')::integer = 2, 'Statistics must match stored registrations';
  assert (snapshot->'majors'->0->>'count')::integer = 2, 'Major aggregate must match';
  assert not snapshot::text like '%example.com%', 'Statistics must not leak email';
  assert (snapshot->>'recentCount')::integer = 2, 'Recent count matches the last hour';
  for attempt in 1..20 loop
    assert public.consume_registration_limit('test-client'), 'First 20 requests are allowed';
  end loop;
  assert not public.consume_registration_limit('test-client'), '21st request must be limited';
  update public.events set registration_open = false where id = event_id;
  assert public.submit_registration(event_id, request_id, details) = first_result, 'Retry remains safe after event closure';
  begin
    perform public.submit_registration(event_id, gen_random_uuid(), details || '{"email":"late@example.com"}');
    raise exception 'Expected closed event to reject registration';
  exception when raise_exception then
    if sqlerrm <> 'event_closed' then raise; end if;
  end;
end;
$$;
set local role authenticated;
set local "realtime.topic" = 'event:a1c08e5d-0817-4684-a03e-1b37c24e1aa1';
do $$ begin assert (select count(*) from realtime.messages) = 2, 'Authorized operator receives broadcasts'; end $$;
set local "request.jwt.claim.sub" = '22222222-2222-4222-a222-222222222222';
do $$ begin assert (select count(*) from realtime.messages) = 0, 'Non-operator receives no broadcasts'; end $$;
do $$ begin
  assert to_regprocedure('public.event_attendees(uuid,text,text,integer,integer)') is null, 'Desk RPC must not exist';
end $$;
rollback;
\echo 'Registration SQL checks passed.'
