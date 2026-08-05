create or replace function public.protect_client_auth_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' and new.client_user_id is not null then
      raise exception 'Only the authentication service can link a client account.';
    end if;

    if tg_op = 'UPDATE' and new.client_user_id is distinct from old.client_user_id then
      raise exception 'Only the authentication service can change a client account link.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_protect_auth_link on public.clients;

create trigger clients_protect_auth_link
before insert or update of client_user_id on public.clients
for each row execute function public.protect_client_auth_link();
