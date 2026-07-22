drop index if exists public.routine_exercises_routine_cycle_position_idx;

alter table public.routine_exercises
drop column if exists cycle_number,
drop column if exists repeat_count,
drop column if exists sets,
drop column if exists load_type,
drop column if exists target_weight;
