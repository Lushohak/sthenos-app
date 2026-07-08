do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_role') then
    create type account_role as enum ('coach', 'trainee');
  end if;
end $$;

alter table public.profiles
add column if not exists role account_role not null default 'coach';

create or replace function public.is_coach(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.role = 'coach'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role account_role := 'coach';
begin
  if new.raw_user_meta_data ->> 'role' = 'trainee' then
    requested_role := 'trainee';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', requested_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

drop policy if exists "coaches manage their clients" on public.clients;
create policy "coaches manage their clients"
on public.clients
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coaches manage their exercises" on public.exercises;
create policy "coaches manage their exercises"
on public.exercises
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coaches manage their routines" on public.workout_routines;
create policy "coaches manage their routines"
on public.workout_routines
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (coach_id = auth.uid() and public.is_coach(auth.uid()));

drop policy if exists "coaches read routine exercises through owned routines" on public.routine_exercises;
create policy "coaches read routine exercises through owned routines"
on public.routine_exercises
for select
to authenticated
using (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
);

drop policy if exists "coaches insert routine exercises through owned routines" on public.routine_exercises;
create policy "coaches insert routine exercises through owned routines"
on public.routine_exercises
for insert
to authenticated
with check (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    join public.exercises e on e.id = routine_exercises.exercise_id
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
      and e.coach_id = auth.uid()
  )
);

drop policy if exists "coaches update routine exercises through owned routines" on public.routine_exercises;
create policy "coaches update routine exercises through owned routines"
on public.routine_exercises
for update
to authenticated
using (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
)
with check (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    join public.exercises e on e.id = routine_exercises.exercise_id
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
      and e.coach_id = auth.uid()
  )
);

drop policy if exists "coaches delete routine exercises through owned routines" on public.routine_exercises;
create policy "coaches delete routine exercises through owned routines"
on public.routine_exercises
for delete
to authenticated
using (
  public.is_coach(auth.uid())
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = routine_exercises.routine_id
      and wr.coach_id = auth.uid()
  )
);

drop policy if exists "coaches manage valid client routine assignments" on public.client_routines;
create policy "coaches manage valid client routine assignments"
on public.client_routines
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and exists (
    select 1
    from public.clients c
    where c.id = client_routines.client_id
      and c.coach_id = auth.uid()
  )
  and exists (
    select 1
    from public.workout_routines wr
    where wr.id = client_routines.routine_id
      and wr.coach_id = auth.uid()
  )
);

drop policy if exists "coaches manage valid workout logs" on public.workout_logs;
create policy "coaches manage valid workout logs"
on public.workout_logs
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and exists (
    select 1
    from public.clients c
    where c.id = workout_logs.client_id
      and c.coach_id = auth.uid()
  )
  and (
    workout_logs.routine_id is null
    or exists (
      select 1
      from public.workout_routines wr
      where wr.id = workout_logs.routine_id
        and wr.coach_id = auth.uid()
    )
  )
);

drop policy if exists "coaches manage body progress for owned clients" on public.body_progress_entries;
create policy "coaches manage body progress for owned clients"
on public.body_progress_entries
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and exists (
    select 1
    from public.clients c
    where c.id = body_progress_entries.client_id
      and c.coach_id = auth.uid()
  )
);
