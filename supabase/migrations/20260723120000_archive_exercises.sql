alter table public.exercises
add column if not exists archived_at timestamptz;

create index if not exists exercises_coach_active_name_idx
on public.exercises(coach_id, name)
where archived_at is null;

create or replace function public.coach_can_add_exercise_to_routine(
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
      and e.archived_at is null
  );
$$;

drop policy if exists "coaches insert routine exercises through owned routines"
on public.routine_exercises;

create policy "coaches insert routine exercises through owned routines"
on public.routine_exercises
for insert
to authenticated
with check (
  public.is_coach(auth.uid())
  and public.coach_can_add_exercise_to_routine(
    routine_exercises.routine_id,
    routine_exercises.exercise_id,
    auth.uid()
  )
);
