drop table if exists public.exercise_progressions;

alter table public.exercises
drop column if exists description,
drop column if exists notes,
drop column if exists is_archived;
