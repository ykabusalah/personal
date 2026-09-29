-- Public totals for the "By the numbers" box on the drawing site's project page.
-- Returns counts only, never individual visits or drawings, so the analytics table can stay private.
-- Run once in the Supabase SQL editor. Safe to run again after edits.

create or replace function public.drawing_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  -- Each visit (one browser tab) that drew on the canvas, and each that submitted, with when it
  -- first did. drawing_start fires on every stroke, so these count visits, not strokes.
  with drew as (
    select session_id, min(created_at) as first_stroke
    from analytics where event_name = 'drawing_start' group by session_id
  ),
  sent as (
    select session_id, min(created_at) as first_submit
    from analytics where event_name = 'submit_success' group by session_id
  )
  select json_build_object(
    -- Same visitor count as the Statistics page: one per browser, all time.
    'visitors', (select count(distinct event_data->>'visitor_id') from analytics),
    'submitted', (select count(*) from drawings),
    'approved', (select count(*) from drawings where status = 'approved'),
    'rejected', (select count(*) from drawings where status = 'rejected'),
    -- Visits that started a drawing, and how many of them went on to submit it.
    'started', (select count(*) from drew),
    'finished', (select count(*) from drew join sent using (session_id)),
    -- The typical (median) time from first stroke to submitting, in seconds.
    'draw_seconds', (
      select round(percentile_cont(0.5) within group (order by extract(epoch from first_submit - first_stroke)::float8))::int
      from drew join sent using (session_id)
      where first_submit > first_stroke
    )
  );
$$;

revoke all on function public.drawing_stats() from public;
grant execute on function public.drawing_stats() to anon, authenticated;
