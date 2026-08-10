do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_gender') then
    create type public.client_gender as enum (
      'male',
      'female',
      'prefer_not_to_say'
    );
  end if;
end $$;

alter table public.clients
add column if not exists gender public.client_gender,
add column if not exists date_of_birth date,
add column if not exists height_cm numeric(5, 1),
add constraint clients_date_of_birth_is_reasonable
  check (
    date_of_birth is null
    or (
      date_of_birth <= current_date
      and date_of_birth > (current_date - interval '121 years')::date
    )
  ),
add constraint clients_height_cm_is_reasonable
  check (height_cm is null or height_cm between 30 and 300);
