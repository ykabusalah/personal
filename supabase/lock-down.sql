-- Lock down the drawings, the analytics, and the drawing uploads.
--
-- What this does:
--   * The public can only see APPROVED drawings. Pending and rejected ones are for the moderator only.
--   * Visitors can still submit drawings, but only as "pending", so nobody can approve their own.
--   * Only the moderator can approve or reject drawings, and only the moderator can read analytics.
--   * Nobody can list the files in drawing-bucket. Approved images still load from their links.
--
-- "Moderator" means one specific account (yours), not anyone who's logged in, because anyone
-- logged in could be a stranger who made an account.
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole file.
-- Put your moderator login email in step 1, then Run. If any step fails, nothing changes.
-- Afterwards, sign out of /moderate and sign back in so your login picks up the moderator flag.

begin;

-- 1. Mark your account as the moderator.
do $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"moderator": true}'
   where lower(email) = lower(trim('YOUR_MODERATOR_EMAIL'));
  if not found then
    raise exception 'No account has that email. Put your moderator login email in step 1 and run it again.';
  end if;
end $$;

-- True only for accounts marked in step 1. Users can't set this flag on themselves.
create or replace function public.is_moderator()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'moderator')::boolean, false)
$$;

-- 2. Drawings: replace whatever rules exist with these four.
alter table public.drawings enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'drawings' loop
    execute format('drop policy %I on public.drawings', p.policyname);
  end loop;
end $$;

create policy "Anyone can see approved drawings" on public.drawings
  for select to anon, authenticated
  using (status = 'approved');

create policy "Moderator can see every drawing" on public.drawings
  for select to authenticated
  using (public.is_moderator());

create policy "Visitors can submit drawings for review" on public.drawings
  for insert to anon, authenticated
  with check (status = 'pending');

create policy "Moderator can approve and reject" on public.drawings
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- 3. Analytics: anyone can send events, only the moderator can read them.
alter table public.analytics enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'analytics' loop
    execute format('drop policy %I on public.analytics', p.policyname);
  end loop;
end $$;

create policy "Visitors can send analytics events" on public.analytics
  for insert to anon, authenticated
  with check (true);

create policy "Moderator can read analytics" on public.analytics
  for select to authenticated
  using (public.is_moderator());

-- 4. Drawing uploads: visitors can add files, but nobody can list them.
-- The bucket is public, so approved images still load from their links without a read rule.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual ilike '%drawing-bucket%' or with_check ilike '%drawing-bucket%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "Visitors can upload drawings" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'drawing-bucket');

commit;
