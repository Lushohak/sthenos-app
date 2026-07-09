alter table public.exercises
add column if not exists description text,
add column if not exists difficulty integer not null default 1 check (difficulty between 1 and 5),
add column if not exists thumbnail_url text,
add column if not exists video_url text,
add column if not exists equipment text,
add column if not exists movement_pattern text,
add column if not exists primary_muscles text[] not null default '{}',
add column if not exists is_archived boolean not null default false;

create table if not exists public.exercise_progressions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  related_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relationship text not null check (relationship in ('easier', 'harder')),
  created_at timestamptz not null default now(),
  constraint exercise_progressions_not_self check (exercise_id <> related_exercise_id),
  constraint exercise_progressions_unique unique (exercise_id, related_exercise_id, relationship)
);

create index if not exists exercise_progressions_coach_id_idx
on public.exercise_progressions(coach_id);

create index if not exists exercise_progressions_exercise_id_idx
on public.exercise_progressions(exercise_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-media',
  'exercise-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.exercise_progressions enable row level security;

drop policy if exists "coaches manage their exercise progressions" on public.exercise_progressions;
create policy "coaches manage their exercise progressions"
on public.exercise_progressions
for all
to authenticated
using (coach_id = auth.uid() and public.is_coach(auth.uid()))
with check (
  coach_id = auth.uid()
  and public.is_coach(auth.uid())
  and exists (
    select 1
    from public.exercises e
    where e.id = exercise_progressions.exercise_id
      and e.coach_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises related
    where related.id = exercise_progressions.related_exercise_id
      and related.coach_id = auth.uid()
  )
);

drop policy if exists "trainees can read progressions for assigned exercises" on public.exercise_progressions;
create policy "trainees can read progressions for assigned exercises"
on public.exercise_progressions
for select
to authenticated
using (
  exists (
    select 1
    from public.routine_exercises re
    join public.client_routines cr on cr.routine_id = re.routine_id
    join public.clients c on c.id = cr.client_id
    where re.exercise_id = exercise_progressions.exercise_id
      and c.client_user_id = auth.uid()
  )
);

drop policy if exists "exercise media is publicly readable" on storage.objects;
create policy "exercise media is publicly readable"
on storage.objects
for select
using (bucket_id = 'exercise-media');

drop policy if exists "coaches upload exercise media" on storage.objects;
create policy "coaches upload exercise media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exercise-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coaches update exercise media" on storage.objects;
create policy "coaches update exercise media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exercise-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'exercise-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coaches delete exercise media" on storage.objects;
create policy "coaches delete exercise media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exercise-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);
