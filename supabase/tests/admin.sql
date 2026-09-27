\set ON_ERROR_STOP on
begin;
insert into auth.users values ('11111111-1111-4111-a111-111111111111');
insert into public.event_operators values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1','11111111-1111-4111-a111-111111111111');
insert into public.event_registrations(event_id, request_id, name, email, phone, major, gender, show_name, created_at)
select 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1', gen_random_uuid(), 'Person ' || i, 'person' || i || '@example.com', '+962790000000', 'Engineering', 'Male', true, now() - interval '1 day'
from generate_series(1, 501) i;
set local role authenticated;
do $$
declare event_id uuid := 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1'; page jsonb; second_page jsonb; batch jsonb; last_row jsonb;
begin
  assert not has_function_privilege('anon', 'public.admin_registrations(uuid,integer,integer)', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.admin_registration_export_page(uuid,timestamptz,timestamptz,uuid)', 'EXECUTE');
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'INSERT');
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'UPDATE');
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'DELETE');
  assert not has_table_privilege('authenticated', 'public.event_registrations', 'SELECT');
  begin perform public.admin_registrations(event_id); raise exception 'Expected denied read'; exception when insufficient_privilege then null; end;
  begin perform public.admin_registration_export_page(event_id); raise exception 'Expected denied export'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', true);
  page := public.admin_registrations(event_id, 0, 25);
  second_page := public.admin_registrations(event_id, 1, 25);
  assert (page->>'total')::int = 501;
  assert jsonb_array_length(page->'rows') = 25;
  assert not exists(select 1 from jsonb_array_elements(page->'rows') a, jsonb_array_elements(second_page->'rows') b where a->>'id' = b->>'id'), 'Pages must not overlap';
  assert jsonb_array_length(public.admin_registrations(event_id, 20, 25)->'rows') = 1;
  assert jsonb_array_length(public.admin_registrations(event_id, 21, 25)->'rows') = 0;
  begin perform public.admin_registrations(event_id, -1, 25); raise exception 'Expected pagination validation'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_registrations(event_id, 0, 1000); raise exception 'Expected bounded page size'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_registrations('22222222-2222-4222-a222-222222222222'); raise exception 'Expected event isolation'; exception when insufficient_privilege then null; end;
  batch := public.admin_registration_export_page(event_id);
  assert jsonb_array_length(batch->'rows') = 500;
  last_row := batch->'rows'->499;
  second_page := public.admin_registration_export_page(event_id, (batch->>'cutoff')::timestamptz, (last_row->>'createdAt')::timestamptz, (last_row->>'id')::uuid);
  assert jsonb_array_length(second_page->'rows') = 1, 'Export must include next batch with tied timestamps';
  assert not exists(select 1 from jsonb_array_elements(batch->'rows') a where a->>'id' = second_page->'rows'->0->>'id');
  assert jsonb_array_length(public.admin_registration_export_page(event_id, now() - interval '2 days')->'rows') = 0, 'Cutoff must exclude newer rows';
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-a222-222222222222', true);
  begin perform public.admin_registration_export_page(event_id); raise exception 'Expected non-operator export denial'; exception when insufficient_privilege then null; end;
end;
$$;
rollback;
\echo 'Read-only admin SQL checks passed.'
