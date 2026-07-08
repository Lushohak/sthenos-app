alter table public.clients
add column if not exists client_user_id uuid references auth.users(id) on delete set null,
add column if not exists invited_at timestamptz,
add column if not exists invitation_accepted_at timestamptz;

create unique index if not exists clients_client_user_id_key
on public.clients(client_user_id)
where client_user_id is not null;

create index if not exists clients_client_user_id_idx
on public.clients(client_user_id);

create policy "trainees can read their own client profile"
on public.clients
for select
to authenticated
using (client_user_id = auth.uid());

create policy "trainees can read their routine assignments"
on public.client_routines
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_routines.client_id
      and c.client_user_id = auth.uid()
  )
);

create policy "trainees can read their assigned routines"
on public.workout_routines
for select
to authenticated
using (
  exists (
    select 1
    from public.client_routines cr
    join public.clients c on c.id = cr.client_id
    where cr.routine_id = workout_routines.id
      and c.client_user_id = auth.uid()
  )
);

create policy "trainees can read assigned routine exercises"
on public.routine_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.client_routines cr
    join public.clients c on c.id = cr.client_id
    where cr.routine_id = routine_exercises.routine_id
      and c.client_user_id = auth.uid()
  )
);

create policy "trainees can read exercises in assigned routines"
on public.exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.routine_exercises re
    join public.client_routines cr on cr.routine_id = re.routine_id
    join public.clients c on c.id = cr.client_id
    where re.exercise_id = exercises.id
      and c.client_user_id = auth.uid()
  )
);

create policy "trainees can read their workout logs"
on public.workout_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = workout_logs.client_id
      and c.client_user_id = auth.uid()
  )
);

create policy "trainees can read their body progress"
on public.body_progress_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = body_progress_entries.client_id
      and c.client_user_id = auth.uid()
  )
);
