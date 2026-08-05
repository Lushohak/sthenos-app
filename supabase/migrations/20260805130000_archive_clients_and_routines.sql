alter table public.workout_routines
add column if not exists archived_at timestamptz;

create index if not exists workout_routines_coach_active_name_idx
on public.workout_routines(coach_id, name)
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
      and wr.archived_at is null
      and e.archived_at is null
  );
$$;

create or replace function public.validate_new_routine_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.clients c
    join public.workout_routines wr on wr.coach_id = c.coach_id
    where c.id = new.client_id
      and wr.id = new.routine_id
      and c.coach_id = new.coach_id
      and c.status = 'active'
      and wr.archived_at is null
  ) then
    raise exception 'New assignments require an active client and active routine.';
  end if;

  return new;
end;
$$;

drop trigger if exists client_routines_validate_new_assignment
on public.client_routines;

create trigger client_routines_validate_new_assignment
before insert or update of client_id, routine_id, coach_id
on public.client_routines
for each row execute function public.validate_new_routine_assignment();
