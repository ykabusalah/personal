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
  select json_build_object(
    -- Same visitor count as the Statistics page: one per browser, all time.
    'visitors', (select count(distinct event_data->>'visitor_id') from analytics),
    'submitted', (select count(*) from drawings),
    'approved', (select count(*) from drawings where status = 'approved'),
    'rejected', (select count(*) from drawings where status = 'rejected')
  );
$$;

revoke all on function public.drawing_stats() from public;
grant execute on function public.drawing_stats() to anon, authenticated;
