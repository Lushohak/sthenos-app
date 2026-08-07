alter table public.body_progress_entries
add column if not exists muscle_mass_percentage numeric(5, 2)
  check (
    muscle_mass_percentage is null
    or muscle_mass_percentage between 0 and 100
  ),
add column if not exists recorded_by uuid
  references public.profiles(id) on delete set null;

update public.body_progress_entries
set recorded_by = coach_id
where recorded_by is null;

drop policy if exists "trainees can add their body progress" on public.body_progress_entries;
create policy "trainees can add their body progress"
on public.body_progress_entries
for insert
to authenticated
with check (
  recorded_by = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = body_progress_entries.client_id
      and c.client_user_id = auth.uid()
      and c.coach_id = body_progress_entries.coach_id
      and c.status = 'active'
  )
);

create or replace function public.validate_body_progress_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recorded_on > current_date then
    raise exception 'Progress entries cannot use a future date.';
  end if;

  if new.body_weight < 1 or new.body_weight > 500 then
    raise exception 'Body weight must be between 1 and 500 kg.';
  end if;

  if (new.waist is not null and (new.waist < 1 or new.waist > 500))
    or (new.chest is not null and (new.chest < 1 or new.chest > 500))
    or (new.arms is not null and (new.arms < 1 or new.arms > 500))
    or (new.legs is not null and (new.legs < 1 or new.legs > 500)) then
    raise exception 'Body measurements must be between 1 and 500 cm.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_body_progress_entry_trigger
on public.body_progress_entries;
create trigger validate_body_progress_entry_trigger
before insert or update on public.body_progress_entries
for each row execute function public.validate_body_progress_entry();
