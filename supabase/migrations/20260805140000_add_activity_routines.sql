alter table public.workout_routines
drop constraint if exists workout_routines_routine_type_check;

alter table public.workout_routines
add constraint workout_routines_routine_type_check
check (routine_type in ('circuit', 'individual', 'activity')),
add column if not exists thumbnail_url text;

alter table public.workout_logs
add column if not exists duration_minutes integer
check (duration_minutes is null or duration_minutes between 1 and 1440);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'routine-media',
  'routine-media',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "routine media is publicly readable" on storage.objects;
create policy "routine media is publicly readable"
on storage.objects
for select
using (bucket_id = 'routine-media');

drop policy if exists "coaches upload routine media" on storage.objects;
create policy "coaches upload routine media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'routine-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coaches update routine media" on storage.objects;
create policy "coaches update routine media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'routine-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'routine-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coaches delete routine media" on storage.objects;
create policy "coaches delete routine media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'routine-media'
  and public.is_coach(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);
