alter table public.routine_exercises
add column if not exists load_type text not null default 'weighted'
  check (load_type in ('weighted', 'bodyweight'));
