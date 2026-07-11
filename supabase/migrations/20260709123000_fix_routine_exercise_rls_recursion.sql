create or replace function public.coach_can_use_exercise_in_routine(
  target_routine_id uuid,
  target_exercise_id uuid,
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
    from public.workout_routines wr
    join public.exercises e on e.coach_id = wr.coach_id
    where wr.id = target_routine_id
      and e.id = target_exercise_id
      and wr.coach_id = target_coach_id
  );
$$;

create or replace function public.trainee_can_read_exercise(
  target_exercise_id uuid,
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
    from public.routine_exercises re
    join public.client_routines cr on cr.routine_id = re.routine_id
    join public.clients c on c.id = cr.client_id
    where re.exercise_id = target_exercise_id
      and c.client_user_id = target_user_id
  );
$$;

drop policy if exists "coaches insert routine exercises through owned routines" on public.routine_exercises;
create policy "coaches insert routine exercises through owned routines"
on public.routine_exercises
for insert
to authenticated
with check (
  public.is_coach(auth.uid())
  and public.coach_can_use_exercise_in_routine(
    routine_exercises.routine_id,
    routine_exercises.exercise_id,
    auth.uid()
  )
);

drop policy if exists "coaches update routine exercises through owned routines" on public.routine_exercises;
create policy "coaches update routine exercises through owned routines"
on public.routine_exercises
for update
to authenticated
using (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
)
with check (
  public.is_coach(auth.uid())
  and public.coach_can_use_exercise_in_routine(
    routine_exercises.routine_id,
    routine_exercises.exercise_id,
    auth.uid()
  )
);

drop policy if exists "trainees can read exercises in assigned routines" on public.exercises;
create policy "trainees can read exercises in assigned routines"
on public.exercises
for select
to authenticated
using (public.trainee_can_read_exercise(exercises.id, auth.uid()));
