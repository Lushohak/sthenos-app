create or replace function public.get_coach_client_last_trained()
returns table (
  client_id uuid,
  last_trained_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with completed_training as (
    select workout_logs.client_id, workout_logs.trained_on as completed_on
    from public.workout_logs
    where workout_logs.coach_id = (select auth.uid())
      and workout_logs.trained_on <= current_date

    union all

    select activity_logs.client_id, activity_logs.performed_on as completed_on
    from public.activity_logs
    where activity_logs.coach_id = (select auth.uid())
      and activity_logs.performed_on <= current_date
  )
  select clients.id as client_id, max(completed_training.completed_on) as last_trained_on
  from public.clients
  left join completed_training on completed_training.client_id = clients.id
  where clients.coach_id = (select auth.uid())
  group by clients.id;
$$;

revoke all on function public.get_coach_client_last_trained() from public;
revoke all on function public.get_coach_client_last_trained() from anon;
grant execute on function public.get_coach_client_last_trained() to authenticated;
