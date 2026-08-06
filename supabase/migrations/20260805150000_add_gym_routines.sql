alter table public.workout_routines
drop constraint if exists workout_routines_routine_type_check;

alter table public.workout_routines
add constraint workout_routines_routine_type_check
check (routine_type in ('circuit', 'individual', 'activity', 'gym'));

alter table public.routine_exercises
add column if not exists sets integer not null default 1
check (sets between 1 and 20);
