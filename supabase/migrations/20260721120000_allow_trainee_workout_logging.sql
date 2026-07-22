create or replace function public.trainee_can_log_workout(
  target_client_id uuid,
  target_routine_id uuid,
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
    join public.client_routines cr
      on cr.client_id = c.id
      and cr.routine_id = target_routine_id
    where c.id = target_client_id
      and c.coach_id = target_coach_id
      and c.client_user_id = target_user_id
      and cr.coach_id = target_coach_id
      and cr.status = 'active'
  );
$$;

drop policy if exists "trainees can log workouts for active assignments" on public.workout_logs;
create policy "trainees can log workouts for active assignments"
on public.workout_logs
for insert
to authenticated
with check (
  routine_id is not null
  and trained_on <= current_date
  and public.trainee_can_log_workout(
    workout_logs.client_id,
    workout_logs.routine_id,
    workout_logs.coach_id,
    auth.uid()
  )
);
