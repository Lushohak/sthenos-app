create or replace function public.get_trainee_peers()
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select peer.name
  from public.clients as viewer
  join public.clients as peer
    on peer.coach_id = viewer.coach_id
  where viewer.client_user_id = (select auth.uid())
    and viewer.status = 'active'
    and peer.id <> viewer.id
    and peer.status = 'active'
    and peer.client_user_id is not null
  order by peer.name;
$$;

revoke all on function public.get_trainee_peers() from public;
revoke all on function public.get_trainee_peers() from anon;
grant execute on function public.get_trainee_peers() to authenticated;
