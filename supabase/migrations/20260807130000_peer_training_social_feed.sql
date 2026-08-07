alter table public.clients
add column if not exists peer_activity_sharing_enabled boolean not null default true;

create or replace function public.set_peer_activity_sharing(target_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_setting boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  update public.clients
  set
    peer_activity_sharing_enabled = target_enabled,
    updated_at = now()
  where client_user_id = (select auth.uid())
    and status <> 'archived'
  returning peer_activity_sharing_enabled into updated_setting;

  if not found then
    raise exception 'An active trainee profile is required.';
  end if;

  return updated_setting;
end;
$$;

revoke all on function public.set_peer_activity_sharing(boolean) from public;
revoke all on function public.set_peer_activity_sharing(boolean) from anon;
grant execute on function public.set_peer_activity_sharing(boolean) to authenticated;

create or replace function public.get_trainee_social_feed()
returns table (
  client_id uuid,
  name text,
  is_viewer boolean,
  sharing_enabled boolean,
  activity_visible boolean,
  current_streak_weeks integer,
  trained_this_week boolean,
  recent_trainings jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select
      c.id,
      c.coach_id,
      c.status,
      c.peer_activity_sharing_enabled
    from public.clients c
    where c.client_user_id = (select auth.uid())
    limit 1
  ),
  community as (
    select
      c.id,
      split_part(btrim(c.name), ' ', 1)::text as name,
      c.peer_activity_sharing_enabled
    from public.clients c
    cross join viewer v
    where c.client_user_id is not null
      and (
        c.id = v.id
        or (
          v.status = 'active'
          and c.status = 'active'
          and c.coach_id = v.coach_id
        )
      )
  ),
  training_sessions as (
    select
      wl.id as session_id,
      wl.client_id,
      wl.trained_on as training_date,
      wl.created_at,
      'Workout'::text as training_type,
      coalesce(wr.name, 'Workout')::text as training_name
    from public.workout_logs wl
    join community c on c.id = wl.client_id
    left join public.workout_routines wr on wr.id = wl.routine_id
    where wl.trained_on <= current_date

    union all

    select
      al.id as session_id,
      al.client_id,
      al.performed_on as training_date,
      al.created_at,
      'Activity'::text as training_type,
      a.name::text as training_name
    from public.activity_logs al
    join community c on c.id = al.client_id
    join public.activities a on a.id = al.activity_id
    where al.performed_on <= current_date
  ),
  training_weeks as (
    select distinct
      ts.client_id,
      date_trunc('week', ts.training_date)::date as week_start
    from training_sessions ts
  )
  select
    c.id as client_id,
    c.name,
    c.id = v.id as is_viewer,
    c.peer_activity_sharing_enabled as sharing_enabled,
    (
      c.id = v.id
      or (
        v.peer_activity_sharing_enabled
        and c.peer_activity_sharing_enabled
      )
    ) as activity_visible,
    case
      when c.id = v.id
        or (
          v.peer_activity_sharing_enabled
          and c.peer_activity_sharing_enabled
        )
      then coalesce(streak.week_count, 0)
      else null
    end as current_streak_weeks,
    case
      when c.id = v.id
        or (
          v.peer_activity_sharing_enabled
          and c.peer_activity_sharing_enabled
        )
      then exists (
        select 1
        from training_weeks tw
        where tw.client_id = c.id
          and tw.week_start = date_trunc('week', current_date)::date
      )
      else null
    end as trained_this_week,
    case
      when c.id = v.id
        or (
          v.peer_activity_sharing_enabled
          and c.peer_activity_sharing_enabled
        )
      then coalesce(recent.items, '[]'::jsonb)
      else '[]'::jsonb
    end as recent_trainings
  from community c
  cross join viewer v
  left join lateral (
    with anchor as (
      select case
        when exists (
          select 1
          from training_weeks tw
          where tw.client_id = c.id
            and tw.week_start = date_trunc('week', current_date)::date
        ) then date_trunc('week', current_date)::date
        when exists (
          select 1
          from training_weeks tw
          where tw.client_id = c.id
            and tw.week_start = date_trunc('week', current_date)::date - 7
        ) then date_trunc('week', current_date)::date - 7
        else null
      end as anchor_week
    ),
    numbered_weeks as (
      select
        tw.week_start,
        row_number() over (order by tw.week_start desc) - 1 as week_offset,
        anchor.anchor_week
      from training_weeks tw
      cross join anchor
      where tw.client_id = c.id
        and anchor.anchor_week is not null
        and tw.week_start <= anchor.anchor_week
    )
    select count(*)::integer as week_count
    from numbered_weeks nw
    where nw.week_start = nw.anchor_week - (nw.week_offset::integer * 7)
  ) streak on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'type', recent.training_type,
        'name', recent.training_name,
        'trained_on', recent.training_date
      )
      order by recent.training_date desc, recent.created_at desc, recent.session_id desc
    ) as items
    from (
      select ts.*
      from training_sessions ts
      where ts.client_id = c.id
      order by ts.training_date desc, ts.created_at desc, ts.session_id desc
      limit 3
    ) recent
  ) recent on true
  order by (c.id = v.id) desc, c.name;
$$;

revoke all on function public.get_trainee_social_feed() from public;
revoke all on function public.get_trainee_social_feed() from anon;
grant execute on function public.get_trainee_social_feed() to authenticated;

drop function if exists public.get_trainee_peers();
