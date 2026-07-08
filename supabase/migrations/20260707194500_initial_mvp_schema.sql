create extension if not exists "pgcrypto";

create type client_status as enum ('active', 'paused', 'archived');
create type assignment_status as enum ('active', 'completed', 'paused');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text,
  age integer check (age is null or age between 1 and 120),
  goal text,
  notes text,
  status client_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null default 1 check (position > 0),
  sets integer not null check (sets > 0),
  reps text not null,
  target_weight text,
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.client_routines (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  status assignment_status not null default 'active',
  notes text
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  routine_id uuid references public.workout_routines(id) on delete set null,
  trained_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.body_progress_entries (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  recorded_on date not null default current_date,
  body_weight numeric(6, 2) not null check (body_weight > 0),
  body_fat_percentage numeric(5, 2) check (
    body_fat_percentage is null or body_fat_percentage between 0 and 100
  ),
  waist numeric(6, 2) check (waist is null or waist > 0),
  chest numeric(6, 2) check (chest is null or chest > 0),
  arms numeric(6, 2) check (arms is null or arms > 0),
  legs numeric(6, 2) check (legs is null or legs > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index clients_coach_id_idx on public.clients(coach_id);
create index exercises_coach_id_idx on public.exercises(coach_id);
create index workout_routines_coach_id_idx on public.workout_routines(coach_id);
create index routine_exercises_routine_id_idx on public.routine_exercises(routine_id);
create index client_routines_coach_id_idx on public.client_routines(coach_id);
create index client_routines_client_id_idx on public.client_routines(client_id);
create index workout_logs_coach_id_trained_on_idx on public.workout_logs(coach_id, trained_on desc);
create index body_progress_client_recorded_idx on public.body_progress_entries(client_id, recorded_on desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create trigger workout_routines_set_updated_at
before update on public.workout_routines
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.client_routines enable row level security;
alter table public.workout_logs enable row level security;
alter table public.body_progress_entries enable row level security;

create policy "profiles are owned by the current user"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "coaches manage their clients"
on public.clients
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coaches manage their exercises"
on public.exercises
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coaches manage their routines"
on public.workout_routines
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coaches read routine exercises through owned routines"
on public.routine_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
);

create policy "coaches insert routine exercises through owned routines"
on public.routine_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workout_routines wr
    join public.exercises e on e.id = routine_exercises.exercise_id
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
      and e.coach_id = auth.uid()
  )
);

create policy "coaches update routine exercises through owned routines"
on public.routine_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_routines wr
    join public.exercises e on e.id = routine_exercises.exercise_id
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
      and e.coach_id = auth.uid()
  )
);

create policy "coaches delete routine exercises through owned routines"
on public.routine_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
);

create policy "coaches manage valid client routine assignments"
on public.client_routines
for all
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = client_routines.client_id
      and c.coach_id = auth.uid()
  )
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = client_routines.routine_id
      and wr.coach_id = auth.uid()
  )
);

create policy "coaches manage valid workout logs"
on public.workout_logs
for all
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = workout_logs.client_id
      and c.coach_id = auth.uid()
  )
  and (
    workout_logs.routine_id is null
    or exists (
      select 1
      from public.workout_routines wr
      where wr.id = workout_logs.routine_id
        and wr.coach_id = auth.uid()
    )
  )
);

create policy "coaches manage body progress for owned clients"
on public.body_progress_entries
for all
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = body_progress_entries.client_id
      and c.coach_id = auth.uid()
  )
);
