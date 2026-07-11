alter table public.workout_routines
add column if not exists routine_type text not null default 'circuit'
  check (routine_type in ('circuit', 'individual')),
add column if not exists default_cycles integer not null default 3
  check (default_cycles between 1 and 12);

alter table public.routine_exercises
add column if not exists cycle_number integer not null default 1
  check (cycle_number between 1 and 12),
add column if not exists repeat_count integer not null default 1
  check (repeat_count between 1 and 20);

create index if not exists routine_exercises_routine_cycle_position_idx
on public.routine_exercises(routine_id, cycle_number, position);
