-- Private registration records. Only the service-role endpoint may create them.
create table public.events (
  id uuid primary key,
  name text not null,
  registration_open boolean not null default true
);
create table public.event_operators (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (event_id, user_id)
);
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  request_id uuid not null unique,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  major text not null check (major in ('Computer Science', 'Engineering', 'Business', 'Medicine', 'Arts & Humanities', 'Science', 'Other')),
  gender text not null check (gender in ('Female', 'Male', 'Prefer not to say')),
  show_name boolean not null,
  created_at timestamptz not null default now(),
  unique(event_id, email)
);
create index event_registrations_time on public.event_registrations(event_id, created_at);
create table public.registration_rate_limits (
  client_hash text not null,
  bucket timestamptz not null,
  attempts integer not null,
  primary key(client_hash, bucket)
);

alter table public.events enable row level security;
alter table public.event_operators enable row level security;
alter table public.event_registrations enable row level security;
alter table public.registration_rate_limits enable row level security;
revoke all on public.events, public.event_operators, public.event_registrations, public.registration_rate_limits from anon, authenticated;
grant select on public.event_operators to authenticated;
create policy "Operators can read their own membership" on public.event_operators for select to authenticated using (user_id = (select auth.uid()));

create function public.consume_registration_limit(client_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_count integer;
begin
  delete from public.registration_rate_limits where bucket < now() - interval '2 hours';
  insert into public.registration_rate_limits values (client_hash, date_trunc('minute', now()), 1)
  on conflict on constraint registration_rate_limits_pkey do update set attempts = public.registration_rate_limits.attempts + 1
  returning attempts into current_count;
  return current_count <= 20;
end;
$$;
revoke all on function public.consume_registration_limit(text) from public, anon, authenticated;
grant execute on function public.consume_registration_limit(text) to service_role;

create function public.registration_welcome(row_data public.event_registrations)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', row_data.id, 'displayName', case when row_data.show_name then split_part(row_data.name, ' ', 1) else null end, 'createdAt', row_data.created_at);
$$;
revoke all on function public.registration_welcome(public.event_registrations) from public, anon, authenticated;

create function public.submit_registration(target_event uuid, request_id uuid, details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.event_registrations;
begin
  -- Serialize retries of the same request. Unique constraints handle simultaneous different requests.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into saved from public.event_registrations r where r.request_id = submit_registration.request_id;
  if found then
    if saved.event_id <> target_event or jsonb_build_object('name', saved.name, 'email', saved.email, 'phone', saved.phone, 'major', saved.major, 'gender', saved.gender, 'showName', saved.show_name) <> details then
      raise exception 'request_conflict';
    end if;
    return public.registration_welcome(saved);
  end if;
  if not exists(select 1 from public.events where id = target_event and registration_open) then raise exception 'event_closed'; end if;
  insert into public.event_registrations(event_id, request_id, name, email, phone, major, gender, show_name)
  values(target_event, request_id, details->>'name', details->>'email', details->>'phone', details->>'major', details->>'gender', (details->>'showName')::boolean)
  returning * into saved;
  return public.registration_welcome(saved);
end;
$$;
revoke all on function public.submit_registration(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_registration(uuid, uuid, jsonb) to service_role;

create function public.broadcast_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(public.registration_welcome(new), 'registration', 'event:' || new.event_id::text, true);
  return new;
end;
$$;
revoke all on function public.broadcast_registration() from public, anon, authenticated;
create trigger registration_committed after insert on public.event_registrations for each row execute function public.broadcast_registration();

create policy "Event operators receive safe welcomes" on realtime.messages for select to authenticated
using (extension = 'broadcast' and exists(select 1 from public.event_operators where user_id = (select auth.uid()) and realtime.topic() = 'event:' || event_id::text));

create function public.event_statistics(target_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.event_operators where event_id = target_event and user_id = (select auth.uid())) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  -- One statement provides a consistent aggregate snapshot without exposing contact data.
  with registrations as (select major, gender, created_at from public.event_registrations where event_id = target_event),
  majors as (select major as name, count(*) as count from registrations group by major),
  genders as (select gender as name, count(*) as count from registrations group by gender),
  timeline as (select date_trunc('hour', created_at) as time, count(*) as count from registrations group by 1)
  select jsonb_build_object(
    'total', (select count(*) from registrations),
    'majors', coalesce((select jsonb_agg(to_jsonb(majors) order by name) from majors), '[]'::jsonb),
    'genders', coalesce((select jsonb_agg(to_jsonb(genders) order by name) from genders), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(to_jsonb(timeline) order by time) from timeline), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.event_statistics(uuid) from public, anon;
grant execute on function public.event_statistics(uuid) to authenticated;

insert into public.events(id, name) values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1', 'Funtime');
