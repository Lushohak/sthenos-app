do $$
begin
  if not exists (select 1 from pg_type where typname = 'training_schedule_kind') then
    create type public.training_schedule_kind as enum ('routine', 'activity', 'open');
  end if;
  if not exists (select 1 from pg_type where typname = 'training_schedule_status') then
    create type public.training_schedule_status as enum ('planned', 'completed', 'skipped', 'missed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'reminder_delivery_status') then
    create type public.reminder_delivery_status as enum ('pending', 'sent', 'failed', 'suppressed');
  end if;
end $$;

alter table public.clients
  add column if not exists timezone text,
  add column if not exists timezone_confirmed_at timestamptz,
  add column if not exists email_workout_reminders_enabled boolean not null default true;

create table if not exists public.training_schedule_series (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  local_time time not null,
  kind public.training_schedule_kind not null,
  routine_assignment_id uuid references public.client_routines(id) on delete cascade,
  activity_assignment_id uuid references public.client_activities(id) on delete cascade,
  open_title text,
  notes text,
  reminder_enabled boolean not null default true,
  starts_on date not null,
  ends_on date,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_schedule_series_date_range check (ends_on is null or ends_on >= starts_on),
  constraint training_schedule_series_content check (
    (kind = 'routine' and routine_assignment_id is not null and activity_assignment_id is null and open_title is null)
    or (kind = 'activity' and activity_assignment_id is not null and routine_assignment_id is null and open_title is null)
    or (kind = 'open' and routine_assignment_id is null and activity_assignment_id is null and length(btrim(open_title)) between 1 and 120)
  )
);

create table if not exists public.training_schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.training_schedule_series(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  scheduled_on date not null,
  scheduled_at timestamptz not null,
  local_time time not null,
  timezone text not null,
  kind public.training_schedule_kind not null,
  routine_assignment_id uuid references public.client_routines(id) on delete cascade,
  activity_assignment_id uuid references public.client_activities(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  notes text,
  reminder_enabled boolean not null default true,
  status public.training_schedule_status not null default 'planned',
  skip_reason text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, scheduled_on),
  constraint training_schedule_occurrences_content check (
    (kind = 'routine' and routine_assignment_id is not null and activity_assignment_id is null)
    or (kind = 'activity' and activity_assignment_id is not null and routine_assignment_id is null)
    or (kind = 'open' and routine_assignment_id is null and activity_assignment_id is null)
  )
);

create table if not exists public.training_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  target_date date not null,
  occurrence_ids uuid[] not null default '{}',
  recipient_email text not null,
  status public.reminder_delivery_status not null default 'pending',
  provider_message_id text,
  attempts smallint not null default 0 check (attempts between 0 and 3),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, target_date)
);

alter table public.workout_logs
  add column if not exists schedule_occurrence_id uuid unique references public.training_schedule_occurrences(id) on delete set null;

alter table public.activity_logs
  add column if not exists schedule_occurrence_id uuid unique references public.training_schedule_occurrences(id) on delete set null;

create index if not exists training_schedule_series_client_idx
  on public.training_schedule_series(client_id, starts_on, ends_on);
create index if not exists training_schedule_occurrences_client_date_idx
  on public.training_schedule_occurrences(client_id, scheduled_on, local_time);
create index if not exists training_schedule_occurrences_reminder_idx
  on public.training_schedule_occurrences(scheduled_on, status, reminder_enabled);
create index if not exists training_reminder_deliveries_status_idx
  on public.training_reminder_deliveries(status, target_date);

create trigger training_schedule_series_set_updated_at
before update on public.training_schedule_series
for each row execute function public.set_updated_at();

create trigger training_schedule_occurrences_set_updated_at
before update on public.training_schedule_occurrences
for each row execute function public.set_updated_at();

create trigger training_reminder_deliveries_set_updated_at
before update on public.training_reminder_deliveries
for each row execute function public.set_updated_at();

create or replace function public.can_manage_training_schedule(
  target_client_id uuid,
  target_coach_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and c.coach_id = target_coach_id
      and c.status <> 'archived'
      and (c.coach_id = target_user_id or c.client_user_id = target_user_id)
  );
$$;

create or replace function public.can_read_training_schedule(
  target_client_id uuid,
  target_coach_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and c.coach_id = target_coach_id
      and (c.coach_id = target_user_id or c.client_user_id = target_user_id)
  );
$$;

create or replace function public.resolve_training_schedule_time(
  target_date date,
  target_time time,
  target_timezone text
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (target_date + target_time) at time zone target_timezone;
$$;

create or replace function public.recalculate_training_schedule_timezone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timezone is distinct from old.timezone and new.timezone is not null then
    if not exists (select 1 from pg_timezone_names where name = new.timezone) then
      raise exception 'Choose a valid IANA timezone.';
    end if;
    update public.training_schedule_occurrences
    set timezone = new.timezone,
        scheduled_at = (scheduled_on + local_time) at time zone new.timezone,
        updated_at = now()
    where client_id = new.id
      and status = 'planned'
      and scheduled_on >= current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists recalculate_training_schedule_timezone_trigger on public.clients;
create trigger recalculate_training_schedule_timezone_trigger
after update of timezone on public.clients
for each row execute function public.recalculate_training_schedule_timezone();

create or replace function public.validate_training_schedule_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.clients%rowtype;
begin
  select * into client_record from public.clients where id = new.client_id;
  if client_record.id is null or client_record.coach_id <> new.coach_id or client_record.status = 'archived' then
    raise exception 'This trainee is not available for scheduling.';
  end if;
  if client_record.timezone is null or not exists (
    select 1 from pg_timezone_names where name = client_record.timezone
  ) then
    raise exception 'Confirm the trainee timezone before scheduling training.';
  end if;

  if new.kind = 'routine'
    and (tg_op = 'INSERT' or new.kind is distinct from old.kind or new.routine_assignment_id is distinct from old.routine_assignment_id)
    and not exists (
    select 1 from public.client_routines cr
    join public.workout_routines wr on wr.id = cr.routine_id
    where cr.id = new.routine_assignment_id
      and cr.client_id = new.client_id
      and cr.coach_id = new.coach_id
      and cr.status = 'active'
      and wr.archived_at is null
      and wr.status = 'published'
  ) then
    raise exception 'Only an active Routine assignment can be scheduled.';
  end if;

  if new.kind = 'activity'
    and (tg_op = 'INSERT' or new.kind is distinct from old.kind or new.activity_assignment_id is distinct from old.activity_assignment_id)
    and not exists (
    select 1 from public.client_activities ca
    join public.activities a on a.id = ca.activity_id
    where ca.id = new.activity_assignment_id
      and ca.client_id = new.client_id
      and ca.coach_id = new.coach_id
      and ca.status = 'active'
      and a.archived_at is null
  ) then
    raise exception 'Only an active Activity assignment can be scheduled.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_training_schedule_series_trigger on public.training_schedule_series;
create trigger validate_training_schedule_series_trigger
before insert or update on public.training_schedule_series
for each row execute function public.validate_training_schedule_series();

create or replace function public.materialize_training_schedule_series(target_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  series_record public.training_schedule_series%rowtype;
  client_timezone text;
  content_title text;
  local_current_date date;
  horizon_end date;
begin
  select * into series_record from public.training_schedule_series where id = target_series_id;
  if series_record.id is null then return; end if;
  select timezone into client_timezone from public.clients where id = series_record.client_id;
  local_current_date := (now() at time zone client_timezone)::date;
  horizon_end := local_current_date + 55;

  if series_record.kind = 'routine' then
    select wr.name into content_title
    from public.client_routines cr join public.workout_routines wr on wr.id = cr.routine_id
    where cr.id = series_record.routine_assignment_id;
  elsif series_record.kind = 'activity' then
    select a.name into content_title
    from public.client_activities ca join public.activities a on a.id = ca.activity_id
    where ca.id = series_record.activity_assignment_id;
  else
    content_title := series_record.open_title;
  end if;

  insert into public.training_schedule_occurrences (
    series_id, coach_id, client_id, scheduled_on, scheduled_at, local_time,
    timezone, kind, routine_assignment_id, activity_assignment_id, title,
    notes, reminder_enabled, created_by, updated_by
  )
  select
    series_record.id,
    series_record.coach_id,
    series_record.client_id,
    day_value::date,
    ((day_value::date + series_record.local_time) at time zone client_timezone),
    series_record.local_time,
    client_timezone,
    series_record.kind,
    series_record.routine_assignment_id,
    series_record.activity_assignment_id,
    content_title,
    series_record.notes,
    series_record.reminder_enabled,
    series_record.created_by,
    series_record.updated_by
  from generate_series(
    greatest(series_record.starts_on, local_current_date)::timestamp,
    least(coalesce(series_record.ends_on, horizon_end), horizon_end)::timestamp,
    interval '1 day'
  ) day_value
  where extract(isodow from day_value)::smallint = series_record.weekday
  on conflict (series_id, scheduled_on) do nothing;
end;
$$;

create or replace function public.validate_training_schedule_occurrence_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.series_id <> old.series_id or new.client_id <> old.client_id
    or new.coach_id <> old.coach_id or new.created_by <> old.created_by then
    raise exception 'Core scheduled-session ownership fields cannot be changed.';
  end if;
  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'Completed sessions cannot be reopened.';
  end if;
  if new.status = 'completed' and old.status <> 'completed'
    and not exists (select 1 from public.workout_logs where schedule_occurrence_id = old.id)
    and not exists (select 1 from public.activity_logs where schedule_occurrence_id = old.id) then
    raise exception 'A completed session must be linked to a training log.';
  end if;
  if new.kind = 'routine'
    and (new.kind is distinct from old.kind or new.routine_assignment_id is distinct from old.routine_assignment_id)
    and not exists (
    select 1 from public.client_routines
    where id = new.routine_assignment_id and client_id = new.client_id and coach_id = new.coach_id and status = 'active'
  ) then
    raise exception 'Only an active Routine assignment can be scheduled.';
  end if;
  if new.kind = 'activity'
    and (new.kind is distinct from old.kind or new.activity_assignment_id is distinct from old.activity_assignment_id)
    and not exists (
    select 1 from public.client_activities
    where id = new.activity_assignment_id and client_id = new.client_id and coach_id = new.coach_id and status = 'active'
  ) then
    raise exception 'Only an active Activity assignment can be scheduled.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_training_schedule_occurrence_update_trigger on public.training_schedule_occurrences;
create trigger validate_training_schedule_occurrence_update_trigger
before update on public.training_schedule_occurrences
for each row execute function public.validate_training_schedule_occurrence_update();

create or replace function public.materialize_training_schedule_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.materialize_training_schedule_series(new.id);
  return new;
end;
$$;

drop trigger if exists materialize_training_schedule_series_trigger on public.training_schedule_series;
create trigger materialize_training_schedule_series_trigger
after insert on public.training_schedule_series
for each row execute function public.materialize_training_schedule_after_change();

create or replace function public.refresh_training_schedule_occurrences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  series_id uuid;
begin
  update public.training_schedule_occurrences
  set status = 'missed', updated_at = now()
  where status = 'planned'
    and scheduled_on < (now() at time zone timezone)::date;

  for series_id in
    select id from public.training_schedule_series
    where ends_on is null or ends_on >= current_date
  loop
    perform public.materialize_training_schedule_series(series_id);
  end loop;
end;
$$;

create or replace function public.update_training_schedule_preferences(
  target_client_id uuid,
  target_timezone text,
  target_reminders_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.clients%rowtype;
begin
  select * into client_record from public.clients where id = target_client_id;
  if client_record.id is null
    or not public.can_manage_training_schedule(client_record.id, client_record.coach_id, auth.uid()) then
    raise exception 'Trainee schedule not found.';
  end if;
  if not exists (select 1 from pg_timezone_names where name = target_timezone) then
    raise exception 'Choose a valid IANA timezone.';
  end if;
  update public.clients
  set timezone = target_timezone,
      timezone_confirmed_at = now(),
      email_workout_reminders_enabled = target_reminders_enabled
  where id = target_client_id;
end;
$$;

create or replace function public.complete_scheduled_workout(
  target_occurrence_id uuid,
  target_duration_minutes integer default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence_record public.training_schedule_occurrences%rowtype;
  routine_value uuid;
  log_id uuid;
begin
  select * into occurrence_record
  from public.training_schedule_occurrences
  where id = target_occurrence_id
  for update;

  if occurrence_record.id is null
    or not public.can_manage_training_schedule(occurrence_record.client_id, occurrence_record.coach_id, auth.uid()) then
    raise exception 'Scheduled session not found.';
  end if;
  if occurrence_record.kind not in ('routine', 'open') then
    raise exception 'This scheduled session is not a workout.';
  end if;
  if occurrence_record.status not in ('planned', 'missed') then
    raise exception 'This scheduled session cannot be completed.';
  end if;
  if occurrence_record.scheduled_on > (now() at time zone occurrence_record.timezone)::date then
    raise exception 'Future sessions cannot be completed.';
  end if;
  if target_duration_minutes is not null and (target_duration_minutes < 1 or target_duration_minutes > 1440) then
    raise exception 'Duration must be between 1 and 1,440 minutes.';
  end if;

  if occurrence_record.kind = 'routine' then
    select routine_id into routine_value
    from public.client_routines
    where id = occurrence_record.routine_assignment_id and status = 'active';
    if routine_value is null then raise exception 'This Routine assignment is not active.'; end if;
  end if;

  insert into public.workout_logs (
    coach_id, client_id, routine_id, trained_on, duration_minutes, notes, schedule_occurrence_id
  ) values (
    occurrence_record.coach_id, occurrence_record.client_id, routine_value,
    occurrence_record.scheduled_on, target_duration_minutes, nullif(btrim(target_notes), ''), occurrence_record.id
  ) returning id into log_id;

  update public.training_schedule_occurrences
  set status = 'completed', skip_reason = null, updated_by = auth.uid()
  where id = occurrence_record.id;
  return log_id;
end;
$$;

create or replace function public.complete_scheduled_activity(
  target_occurrence_id uuid,
  target_duration_minutes numeric default null,
  target_distance_km numeric default null,
  target_elevation_gain_m numeric default null,
  target_calories_burned integer default null,
  target_perceived_intensity integer default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence_record public.training_schedule_occurrences%rowtype;
  assignment_record public.client_activities%rowtype;
  log_id uuid;
begin
  select * into occurrence_record from public.training_schedule_occurrences
  where id = target_occurrence_id for update;
  if occurrence_record.id is null
    or not public.can_manage_training_schedule(occurrence_record.client_id, occurrence_record.coach_id, auth.uid()) then
    raise exception 'Scheduled session not found.';
  end if;
  if occurrence_record.kind <> 'activity' or occurrence_record.status not in ('planned', 'missed') then
    raise exception 'This scheduled Activity cannot be completed.';
  end if;
  if occurrence_record.scheduled_on > (now() at time zone occurrence_record.timezone)::date then
    raise exception 'Future sessions cannot be completed.';
  end if;
  select * into assignment_record from public.client_activities
  where id = occurrence_record.activity_assignment_id and status = 'active';
  if assignment_record.id is null then raise exception 'This Activity assignment is not active.'; end if;

  log_id := public.create_assigned_activity_log(
    assignment_record.id,
    occurrence_record.scheduled_on,
    target_duration_minutes,
    target_distance_km,
    target_elevation_gain_m,
    target_calories_burned,
    target_perceived_intensity,
    target_notes
  );
  update public.activity_logs
  set schedule_occurrence_id = occurrence_record.id
  where id = log_id;
  update public.training_schedule_occurrences
  set status = 'completed', skip_reason = null, updated_by = auth.uid()
  where id = occurrence_record.id;
  return log_id;
end;
$$;

alter table public.training_schedule_series enable row level security;
alter table public.training_schedule_occurrences enable row level security;
alter table public.training_reminder_deliveries enable row level security;

create policy "schedule participants read series"
on public.training_schedule_series for select to authenticated
using (public.can_read_training_schedule(client_id, coach_id, auth.uid()));
create policy "schedule participants create series"
on public.training_schedule_series for insert to authenticated
with check (
  public.can_manage_training_schedule(client_id, coach_id, auth.uid())
  and created_by = auth.uid() and updated_by = auth.uid()
);
create policy "schedule participants update series"
on public.training_schedule_series for update to authenticated
using (public.can_manage_training_schedule(client_id, coach_id, auth.uid()))
with check (public.can_manage_training_schedule(client_id, coach_id, auth.uid()) and updated_by = auth.uid());
create policy "schedule participants delete series"
on public.training_schedule_series for delete to authenticated
using (public.can_manage_training_schedule(client_id, coach_id, auth.uid()));

create policy "schedule participants read occurrences"
on public.training_schedule_occurrences for select to authenticated
using (public.can_read_training_schedule(client_id, coach_id, auth.uid()));
create policy "schedule participants update occurrences"
on public.training_schedule_occurrences for update to authenticated
using (public.can_manage_training_schedule(client_id, coach_id, auth.uid()))
with check (public.can_manage_training_schedule(client_id, coach_id, auth.uid()) and updated_by = auth.uid());

create policy "schedule participants read reminder deliveries"
on public.training_reminder_deliveries for select to authenticated
using (public.can_read_training_schedule(client_id, coach_id, auth.uid()));

grant select, insert, update, delete on public.training_schedule_series to authenticated;
grant select, update on public.training_schedule_occurrences to authenticated;
grant select on public.training_reminder_deliveries to authenticated;
grant execute on function public.can_manage_training_schedule(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.can_read_training_schedule(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.resolve_training_schedule_time(date, time, text) to authenticated, service_role;
grant execute on function public.refresh_training_schedule_occurrences() to authenticated, service_role;
grant execute on function public.update_training_schedule_preferences(uuid, text, boolean) to authenticated;
grant execute on function public.complete_scheduled_workout(uuid, integer, text) to authenticated;
grant execute on function public.complete_scheduled_activity(uuid, numeric, numeric, numeric, integer, integer, text) to authenticated;
