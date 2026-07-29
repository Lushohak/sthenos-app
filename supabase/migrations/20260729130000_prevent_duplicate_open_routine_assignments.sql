do $$
begin
  if exists (
    select 1
    from public.client_routines
    where status in ('active', 'paused')
    group by client_id, routine_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate active or paused routine assignments exist. Resolve them before applying this migration.';
  end if;
end
$$;

create unique index if not exists client_routines_one_open_assignment_per_routine
on public.client_routines (client_id, routine_id)
where status in ('active', 'paused');
