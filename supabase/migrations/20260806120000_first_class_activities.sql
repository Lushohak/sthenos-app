do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_metric') then
    create type activity_metric as enum (
      'duration_minutes',
      'distance_km',
      'elevation_gain_m',
      'calories_burned',
      'perceived_intensity'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_assignment_mode') then
    create type activity_assignment_mode as enum ('repeatable', 'one_time');
  end if;
end $$;

create or replace function public.activity_targets_are_valid(
  targets jsonb,
  tracked activity_metric[]
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(targets) = 'object'
    and not exists (
      select 1
      from jsonb_each(targets) as item(metric_key, metric_value)
      where not (metric_key = any(tracked::text[]))
        or jsonb_typeof(metric_value) <> 'number'
        or case metric_key
          when 'duration_minutes' then
            (metric_value #>> '{}')::numeric < 1
            or (metric_value #>> '{}')::numeric > 1440
            or (metric_value #>> '{}')::numeric <> trunc((metric_value #>> '{}')::numeric)
          when 'distance_km' then (metric_value #>> '{}')::numeric <= 0
          when 'elevation_gain_m' then (metric_value #>> '{}')::numeric <= 0
          when 'calories_burned' then
            (metric_value #>> '{}')::numeric < 1
            or (metric_value #>> '{}')::numeric <> trunc((metric_value #>> '{}')::numeric)
          when 'perceived_intensity' then
            (metric_value #>> '{}')::numeric < 1
            or (metric_value #>> '{}')::numeric > 10
            or (metric_value #>> '{}')::numeric <> trunc((metric_value #>> '{}')::numeric)
          else true
        end
    );
$$;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  thumbnail_url text,
  tracked_metrics activity_metric[] not null default '{}'::activity_metric[],
  required_metrics activity_metric[] not null default '{}'::activity_metric[],
  default_targets jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_required_metrics_are_tracked
    check (required_metrics <@ tracked_metrics),
  constraint activities_default_targets_are_valid
    check (public.activity_targets_are_valid(default_targets, tracked_metrics))
);

create table public.client_activities (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  assignment_mode activity_assignment_mode not null default 'repeatable',
  planned_for date,
  tracked_metrics activity_metric[] not null default '{}'::activity_metric[],
  required_metrics activity_metric[] not null default '{}'::activity_metric[],
  targets jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  status assignment_status not null default 'active',
  notes text,
  constraint client_activities_required_metrics_are_tracked
    check (required_metrics <@ tracked_metrics),
  constraint client_activities_targets_are_valid
    check (public.activity_targets_are_valid(targets, tracked_metrics)),
  constraint client_activities_repeatable_has_no_planned_date
    check (assignment_mode = 'one_time' or planned_for is null)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  assignment_id uuid references public.client_activities(id) on delete set null,
  performed_on date not null default current_date check (performed_on <= current_date),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  distance_km numeric(9, 3) check (distance_km is null or distance_km > 0),
  elevation_gain_m numeric(9, 2) check (elevation_gain_m is null or elevation_gain_m > 0),
  calories_burned integer check (calories_burned is null or calories_burned > 0),
  perceived_intensity integer check (
    perceived_intensity is null or perceived_intensity between 1 and 10
  ),
  notes text,
  created_at timestamptz not null default now()
);

create index activities_coach_active_name_idx
on public.activities(coach_id, name)
where archived_at is null;

create index client_activities_coach_id_idx
on public.client_activities(coach_id);

create index client_activities_client_id_idx
on public.client_activities(client_id);

create unique index client_activities_one_open_assignment
on public.client_activities(client_id, activity_id)
where status in ('active', 'paused');

create index activity_logs_coach_performed_idx
on public.activity_logs(coach_id, performed_on desc);

create index activity_logs_client_performed_idx
on public.activity_logs(client_id, performed_on desc);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

insert into public.activities (
  id,
  coach_id,
  name,
  description,
  thumbnail_url,
  tracked_metrics,
  required_metrics,
  default_targets,
  archived_at,
  created_at,
  updated_at
)
select
  id,
  coach_id,
  name,
  description,
  thumbnail_url,
  array['duration_minutes']::activity_metric[],
  '{}'::activity_metric[],
  '{}'::jsonb,
  archived_at,
  created_at,
  updated_at
from public.workout_routines
where routine_type = 'activity'
on conflict (id) do nothing;

insert into public.client_activities (
  id,
  coach_id,
  client_id,
  activity_id,
  assignment_mode,
  planned_for,
  tracked_metrics,
  required_metrics,
  targets,
  assigned_at,
  status,
  notes
)
select
  cr.id,
  cr.coach_id,
  cr.client_id,
  cr.routine_id,
  'repeatable'::activity_assignment_mode,
  null,
  array['duration_minutes']::activity_metric[],
  '{}'::activity_metric[],
  '{}'::jsonb,
  cr.assigned_at,
  cr.status,
  cr.notes
from public.client_routines cr
join public.workout_routines wr on wr.id = cr.routine_id
where wr.routine_type = 'activity'
on conflict (id) do nothing;

insert into public.activity_logs (
  id,
  coach_id,
  client_id,
  activity_id,
  assignment_id,
  performed_on,
  duration_minutes,
  notes,
  created_at
)
select
  wl.id,
  wl.coach_id,
  wl.client_id,
  wl.routine_id,
  assignment.id,
  wl.trained_on,
  wl.duration_minutes,
  wl.notes,
  wl.created_at
from public.workout_logs wl
join public.workout_routines wr
  on wr.id = wl.routine_id
  and wr.routine_type = 'activity'
left join lateral (
  select ca.id
  from public.client_activities ca
  where ca.client_id = wl.client_id
    and ca.activity_id = wl.routine_id
  order by ca.assigned_at desc
  limit 1
) assignment on true
on conflict (id) do nothing;

delete from public.workout_logs wl
using public.workout_routines wr
where wl.routine_id = wr.id
  and wr.routine_type = 'activity';

delete from public.client_routines cr
using public.workout_routines wr
where cr.routine_id = wr.id
  and wr.routine_type = 'activity';

delete from public.workout_routines
where routine_type = 'activity';

alter table public.workout_routines
drop constraint if exists workout_routines_routine_type_check;

alter table public.workout_routines
add constraint workout_routines_routine_type_check
check (routine_type in ('circuit', 'individual', 'gym'));

alter table public.workout_routines
drop column if exists thumbnail_url;

alter table public.activities enable row level security;
alter table public.client_activities enable row level security;
alter table public.activity_logs enable row level security;

create or replace function public.coach_owns_activity_assignment_relations(
  target_client_id uuid,
  target_activity_id uuid,
  target_coach_id uuid
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
    join public.activities a on a.coach_id = c.coach_id
    where c.id = target_client_id
      and a.id = target_activity_id
      and c.coach_id = target_coach_id
  );
$$;

create or replace function public.trainee_can_read_activity(
  target_activity_id uuid,
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
    from public.client_activities ca
    join public.clients c on c.id = ca.client_id
    where ca.activity_id = target_activity_id
      and c.client_user_id = target_user_id
  );
$$;

create or replace function public.validate_new_activity_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.clients c
    join public.activities a on a.coach_id = c.coach_id
    where c.id = new.client_id
      and a.id = new.activity_id
      and c.coach_id = new.coach_id
      and c.status = 'active'
      and a.archived_at is null
  ) then
    raise exception 'New assignments require an active client and active activity.';
  end if;

  return new;
end;
$$;

create trigger client_activities_validate_new_assignment
before insert on public.client_activities
for each row execute function public.validate_new_activity_assignment();

create policy "coaches manage their activities"
on public.activities
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

create policy "trainees read assigned activities"
on public.activities
for select
to authenticated
using (
  public.trainee_can_read_activity(activities.id, auth.uid())
);

create policy "coaches manage valid activity assignments"
on public.client_activities
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and public.coach_owns_activity_assignment_relations(
    client_activities.client_id,
    client_activities.activity_id,
    auth.uid()
  )
);

create policy "trainees read their activity assignments"
on public.client_activities
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_activities.client_id
      and c.client_user_id = auth.uid()
  )
);

create policy "coaches manage valid activity logs"
on public.activity_logs
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and public.coach_owns_activity_assignment_relations(
    activity_logs.client_id,
    activity_logs.activity_id,
    auth.uid()
  )
);

create policy "trainees read their activity logs"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = activity_logs.client_id
      and c.client_user_id = auth.uid()
  )
);

create or replace function public.create_assigned_activity_log(
  target_assignment_id uuid,
  target_performed_on date,
  target_duration_minutes integer default null,
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
  assignment_record record;
  new_log_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select
    ca.*,
    c.client_user_id
  into assignment_record
  from public.client_activities ca
  join public.clients c on c.id = ca.client_id
  where ca.id = target_assignment_id
  for update of ca;

  if not found then
    raise exception 'Activity assignment not found.';
  end if;

  if assignment_record.coach_id <> actor_id
    and assignment_record.client_user_id is distinct from actor_id then
    raise exception 'You cannot log this activity.';
  end if;

  if assignment_record.status <> 'active' then
    raise exception 'This activity assignment is not active.';
  end if;

  if target_performed_on is null or target_performed_on > current_date then
    raise exception 'Choose today or an earlier activity date.';
  end if;

  if target_duration_minutes is not null
    and not ('duration_minutes'::activity_metric = any(assignment_record.tracked_metrics)) then
    raise exception 'Duration is not tracked for this activity.';
  end if;
  if target_distance_km is not null
    and not ('distance_km'::activity_metric = any(assignment_record.tracked_metrics)) then
    raise exception 'Distance is not tracked for this activity.';
  end if;
  if target_elevation_gain_m is not null
    and not ('elevation_gain_m'::activity_metric = any(assignment_record.tracked_metrics)) then
    raise exception 'Elevation gain is not tracked for this activity.';
  end if;
  if target_calories_burned is not null
    and not ('calories_burned'::activity_metric = any(assignment_record.tracked_metrics)) then
    raise exception 'Calories are not tracked for this activity.';
  end if;
  if target_perceived_intensity is not null
    and not ('perceived_intensity'::activity_metric = any(assignment_record.tracked_metrics)) then
    raise exception 'Perceived intensity is not tracked for this activity.';
  end if;

  if 'duration_minutes'::activity_metric = any(assignment_record.required_metrics)
    and target_duration_minutes is null then
    raise exception 'Duration is required.';
  end if;
  if 'distance_km'::activity_metric = any(assignment_record.required_metrics)
    and target_distance_km is null then
    raise exception 'Distance is required.';
  end if;
  if 'elevation_gain_m'::activity_metric = any(assignment_record.required_metrics)
    and target_elevation_gain_m is null then
    raise exception 'Elevation gain is required.';
  end if;
  if 'calories_burned'::activity_metric = any(assignment_record.required_metrics)
    and target_calories_burned is null then
    raise exception 'Estimated calories are required.';
  end if;
  if 'perceived_intensity'::activity_metric = any(assignment_record.required_metrics)
    and target_perceived_intensity is null then
    raise exception 'Perceived intensity is required.';
  end if;

  if target_duration_minutes is not null
    and (target_duration_minutes < 1 or target_duration_minutes > 1440) then
    raise exception 'Duration must be between 1 and 1,440 minutes.';
  end if;
  if target_distance_km is not null and target_distance_km <= 0 then
    raise exception 'Distance must be greater than zero.';
  end if;
  if target_elevation_gain_m is not null and target_elevation_gain_m <= 0 then
    raise exception 'Elevation gain must be greater than zero.';
  end if;
  if target_calories_burned is not null and target_calories_burned < 1 then
    raise exception 'Estimated calories must be greater than zero.';
  end if;
  if target_perceived_intensity is not null
    and (target_perceived_intensity < 1 or target_perceived_intensity > 10) then
    raise exception 'Perceived intensity must be between 1 and 10.';
  end if;

  insert into public.activity_logs (
    coach_id,
    client_id,
    activity_id,
    assignment_id,
    performed_on,
    duration_minutes,
    distance_km,
    elevation_gain_m,
    calories_burned,
    perceived_intensity,
    notes
  ) values (
    assignment_record.coach_id,
    assignment_record.client_id,
    assignment_record.activity_id,
    assignment_record.id,
    target_performed_on,
    target_duration_minutes,
    target_distance_km,
    target_elevation_gain_m,
    target_calories_burned,
    target_perceived_intensity,
    nullif(btrim(target_notes), '')
  )
  returning id into new_log_id;

  if assignment_record.assignment_mode = 'one_time' then
    update public.client_activities
    set status = 'completed'
    where id = assignment_record.id;
  end if;

  return new_log_id;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-media',
  'activity-media',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "activity media is publicly readable"
on storage.objects
for select
using (bucket_id = 'activity-media');

create policy "coaches upload activity media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'activity-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "coaches update activity media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'activity-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'activity-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "coaches delete activity media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'activity-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

grant select, insert, update, delete
on public.activities, public.client_activities, public.activity_logs
to authenticated, service_role;

revoke execute on function public.coach_owns_activity_assignment_relations(
  uuid, uuid, uuid
) from public, anon;

grant execute on function public.coach_owns_activity_assignment_relations(
  uuid, uuid, uuid
) to authenticated, service_role;

revoke execute on function public.trainee_can_read_activity(
  uuid, uuid
) from public, anon;

grant execute on function public.trainee_can_read_activity(
  uuid, uuid
) to authenticated, service_role;

revoke execute on function public.create_assigned_activity_log(
  uuid, date, integer, numeric, numeric, integer, integer, text
) from public, anon;

grant execute on function public.create_assigned_activity_log(
  uuid, date, integer, numeric, numeric, integer, integer, text
) to authenticated, service_role;
