begin;
create or replace function public.check_in_attendance(target_event uuid, request_id uuid, participant_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.event_registrations; previous public.attendance_scans; result jsonb; already boolean;
begin
  -- Check membership before participant lookup AND idempotent replay.
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if participant_id is null or char_length(btrim(participant_id)) not between 1 and 100 then raise exception 'Invalid ID' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into previous from public.attendance_scans s where s.request_id = check_in_attendance.request_id;
  if found then
    if previous.event_id <> target_event or previous.participant_id <> btrim(check_in_attendance.participant_id) then raise exception 'request_conflict'; end if;
    return previous.result;
  end if;
  if not exists(select 1 from public.events where id = target_event and registration_open) then raise exception 'event_closed'; end if;
  select * into saved from public.event_registrations r where r.event_id = target_event
    and r.participant_id = btrim(check_in_attendance.participant_id) for update;
  if not found then raise exception 'participant_not_found'; end if;
  already := saved.attended_at is not null;
  if not already then
    update public.event_registrations set attended_at = clock_timestamp() where id = saved.id returning * into saved;
  end if;
  -- Each deliberate scan has a new welcome ID; retrying a request reuses its result.
  result := jsonb_build_object('id', request_id, 'displayName', saved.full_name, 'createdAt', clock_timestamp(), 'alreadyAttended', already);
  insert into public.attendance_scans values(request_id, target_event, btrim(participant_id), result);
  perform realtime.send(result, 'registration', 'event:' || target_event::text, true);
  return result;
end;
$$;
revoke all on function public.check_in_attendance(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.check_in_attendance(uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
