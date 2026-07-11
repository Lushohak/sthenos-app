create or replace function public.coach_can_assign_routine(
  target_client_id uuid,
  target_routine_id uuid,
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
    join public.workout_routines wr on wr.coach_id = c.coach_id
    where c.id = target_client_id
      and wr.id = target_routine_id
      and c.coach_id = target_coach_id
  );
$$;

create or replace function public.trainee_can_read_routine(
  target_routine_id uuid,
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
    from public.client_routines cr
    join public.clients c on c.id = cr.client_id
    where cr.routine_id = target_routine_id
      and c.client_user_id = target_user_id
  );
$$;

drop policy if exists "coaches manage valid client routine assignments" on public.client_routines;
create policy "coaches manage valid client routine assignments"
on public.client_routines
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and public.coach_can_assign_routine(
    client_routines.client_id,
    client_routines.routine_id,
    auth.uid()
  )
);

drop policy if exists "trainees can read their assigned routines" on public.workout_routines;
create policy "trainees can read their assigned routines"
on public.workout_routines
for select
to authenticated
using (public.trainee_can_read_routine(workout_routines.id, auth.uid()));
