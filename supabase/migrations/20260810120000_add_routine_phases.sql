do $$
begin
  create type public.routine_phase as enum ('warmup', 'main', 'cooldown');
exception
  when duplicate_object then null;
end
$$;

alter table public.workout_routines
add column if not exists warmup_notes text,
add column if not exists workout_notes text,
add column if not exists cooldown_notes text;

alter table public.routine_exercises
add column if not exists phase public.routine_phase not null default 'main';

create index if not exists routine_exercises_routine_phase_position_idx
on public.routine_exercises(routine_id, phase, position);

create or replace function public.bulk_create_and_add_routine_exercises(
  target_routine_id uuid,
  exercise_items jsonb
)
returns table (
  exercise_id uuid,
  routine_exercise_id uuid,
  reused boolean
)
language plpgsql
set search_path = public
as $$
declare
  owned_routine public.workout_routines%rowtype;
  exercise_item jsonb;
  created_exercise_id uuid;
  created_routine_exercise_id uuid;
  existing_exercise_id uuid;
  selected_phase public.routine_phase;
  base_position integer;
  item_index integer := 0;
  item_count integer;
begin
  select *
  into owned_routine
  from public.workout_routines
  where id = target_routine_id
    and coach_id = auth.uid()
    and archived_at is null;

  if not found then
    raise exception 'Routine is unavailable.';
  end if;

  if jsonb_typeof(exercise_items) <> 'array' then
    raise exception 'Exercise items must be an array.';
  end if;

  item_count := jsonb_array_length(exercise_items);
  if item_count < 1 or item_count > 25 then
    raise exception 'Create between 1 and 25 exercises at a time.';
  end if;

  select coalesce(max(position), 0)
  into base_position
  from public.routine_exercises
  where routine_id = target_routine_id;

  for exercise_item in select value from jsonb_array_elements(exercise_items)
  loop
    item_index := item_index + 1;
    existing_exercise_id := nullif(exercise_item ->> 'existing_exercise_id', '')::uuid;
    selected_phase := coalesce(
      nullif(exercise_item ->> 'phase', '')::public.routine_phase,
      'main'::public.routine_phase
    );

    if existing_exercise_id is not null then
      select id
      into created_exercise_id
      from public.exercises
      where id = existing_exercise_id
        and coach_id = auth.uid()
        and archived_at is null;

      if not found then
        raise exception 'An exercise selected for reuse is unavailable.';
      end if;
    else
      if length(trim(coalesce(exercise_item ->> 'name', ''))) = 0 then
        raise exception 'Every new exercise requires a name.';
      end if;

      insert into public.exercises (
        coach_id,
        name,
        category,
        difficulty,
        thumbnail_url,
        video_url,
        equipment,
        movement_pattern,
        primary_muscles
      )
      values (
        auth.uid(),
        trim(exercise_item ->> 'name'),
        nullif(trim(exercise_item ->> 'category'), ''),
        least(5, greatest(1, coalesce((exercise_item ->> 'difficulty')::integer, 1))),
        nullif(trim(exercise_item ->> 'thumbnail_url'), ''),
        nullif(trim(exercise_item ->> 'video_url'), ''),
        nullif(trim(exercise_item ->> 'equipment'), ''),
        nullif(trim(exercise_item ->> 'movement_pattern'), ''),
        coalesce(
          array(select jsonb_array_elements_text(exercise_item -> 'primary_muscles')),
          '{}'::text[]
        )
      )
      returning id into created_exercise_id;
    end if;

    insert into public.routine_exercises (
      routine_id,
      exercise_id,
      position,
      phase,
      sets,
      reps,
      rest_seconds,
      notes
    )
    values (
      target_routine_id,
      created_exercise_id,
      base_position + item_index,
      selected_phase,
      case
        when selected_phase = 'main' and owned_routine.routine_type = 'gym'
          then least(20, greatest(1, coalesce((exercise_item ->> 'sets')::integer, 3)))
        else 1
      end,
      coalesce(nullif(trim(exercise_item ->> 'reps'), ''), '10'),
      case
        when nullif(trim(exercise_item ->> 'rest_seconds'), '') is null then null
        else greatest(0, (exercise_item ->> 'rest_seconds')::integer)
      end,
      nullif(trim(exercise_item ->> 'notes'), '')
    )
    returning id into created_routine_exercise_id;

    exercise_id := created_exercise_id;
    routine_exercise_id := created_routine_exercise_id;
    reused := existing_exercise_id is not null;
    return next;
  end loop;
end;
$$;

revoke all on function public.bulk_create_and_add_routine_exercises(uuid, jsonb)
from public;
grant execute on function public.bulk_create_and_add_routine_exercises(uuid, jsonb)
to authenticated;
