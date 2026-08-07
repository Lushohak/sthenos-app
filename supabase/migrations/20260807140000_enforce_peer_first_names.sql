alter function public.get_trainee_social_feed()
rename to get_trainee_social_feed_internal;

revoke all on function public.get_trainee_social_feed_internal() from public;
revoke all on function public.get_trainee_social_feed_internal() from anon;
revoke all on function public.get_trainee_social_feed_internal() from authenticated;

create function public.get_trainee_social_feed()
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
  select
    feed.client_id,
    split_part(btrim(feed.name), ' ', 1)::text as name,
    feed.is_viewer,
    feed.sharing_enabled,
    feed.activity_visible,
    feed.current_streak_weeks,
    feed.trained_this_week,
    feed.recent_trainings
  from public.get_trainee_social_feed_internal() feed;
$$;

revoke all on function public.get_trainee_social_feed() from public;
revoke all on function public.get_trainee_social_feed() from anon;
grant execute on function public.get_trainee_social_feed() to authenticated;
