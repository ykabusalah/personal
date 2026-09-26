-- Doodle Studio: the private drawing page in studio/, where doodles for the site get drawn.
-- Run once in the Supabase SQL editor. Safe to run again after edits.
--
-- Nobody can read or write these tables directly. The studio only goes through the functions
-- below, and every one of them checks the key from a private link first. Only a scrambled copy
-- of each key is stored, so the table itself can't be used to rebuild a link.
--
-- Make a link (run on its own, then copy the result into https://<studio address>/#key=<result>):
--   select public.studio_new_link('Friend');
-- Make your own link, which sees everyone's doodles and is what `npm run doodles:pull` uses:
--   select public.studio_new_link('Yousef', true);
-- Turn a link off:
--   update public.studio_links set active = false where label = 'Friend';

create table if not exists public.studio_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique,
  owner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- When the link's artist agreed to the note on the studio's welcome screen (that everything they
-- save is yours to use, uncredited).
alter table public.studio_links add column if not exists accepted_at timestamptz;

create table if not exists public.studio_doodles (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.studio_links (id),
  name text not null default '',
  strokes jsonb not null,
  -- The finished doodle, cropped to its ink, and a small copy for the studio's list.
  image text not null,
  thumb text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deleting only hides a doodle, so nothing drawn is ever lost by accident.
  deleted_at timestamptz
);

-- Which doodle spot on the site it fills. Only the owner link sees or sets this, so artists never
-- see where their doodles end up.
alter table public.studio_doodles add column if not exists spot text;

alter table public.studio_links enable row level security;
alter table public.studio_doodles enable row level security;
revoke all on public.studio_links, public.studio_doodles from anon, authenticated;

-- The link a key belongs to, or an error if the key is wrong or turned off.
create or replace function public.studio_check(key text)
returns public.studio_links
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.studio_links;
begin
  select * into link from public.studio_links l
  where l.key_hash = encode(sha256(convert_to(coalesce(key, ''), 'UTF8')), 'hex') and l.active;
  if not found then
    raise exception 'This studio link doesn''t work anymore.' using errcode = '28000';
  end if;
  return link;
end;
$$;

create or replace function public.studio_hello(key text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  return json_build_object('label', link.label, 'owner', link.owner, 'accepted', link.owner or link.accepted_at is not null);
end;
$$;

create or replace function public.studio_accept(key text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  update public.studio_links l set accepted_at = coalesce(l.accepted_at, now()) where l.id = link.id;
end;
$$;

-- Saved doodles: your own, or everyone's (and their spots) for the owner link.
drop function if exists public.studio_list(text);
create function public.studio_list(key text)
returns table (id uuid, name text, artist text, spot text, thumb text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  return query
    select d.id, d.name, l.label, case when link.owner then d.spot end, d.thumb, d.updated_at
    from public.studio_doodles d
    join public.studio_links l on l.id = d.link_id
    where d.deleted_at is null and (link.owner or d.link_id = link.id)
    order by d.updated_at desc;
end;
$$;

-- One doodle's strokes, to keep working on it.
create or replace function public.studio_get(key text, doodle uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
  found_doodle public.studio_doodles;
begin
  select * into found_doodle from public.studio_doodles d
  where d.id = doodle and d.deleted_at is null and (link.owner or d.link_id = link.id);
  if not found then
    raise exception 'That doodle couldn''t be found.';
  end if;
  return json_build_object(
    'id', found_doodle.id,
    'name', found_doodle.name,
    'spot', case when link.owner then found_doodle.spot end,
    'strokes', found_doodle.strokes
  );
end;
$$;

-- Put a doodle in a spot on the site, or take it out (spot is null). Owner link only.
create or replace function public.studio_assign(key text, doodle uuid, spot text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  if not link.owner then
    raise exception 'Only the owner link can place doodles.' using errcode = '42501';
  end if;
  update public.studio_doodles d
  set spot = nullif(trim(studio_assign.spot), '')
  where d.id = doodle and d.deleted_at is null;
end;
$$;

-- Save a new doodle (doodle is null) or update one. Returns its id.
create or replace function public.studio_save(key text, doodle uuid, name text, strokes jsonb, image text, thumb text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
  saved uuid;
begin
  if length(coalesce(studio_save.name, '')) > 80 then
    raise exception 'That name is too long.';
  end if;
  if octet_length(studio_save.strokes::text) > 8000000
    or length(studio_save.image) > 6000000
    or length(studio_save.thumb) > 400000 then
    raise exception 'This drawing is too big to save.';
  end if;
  if studio_save.image not like 'data:image/png;base64,%' or studio_save.thumb not like 'data:image/png;base64,%' then
    raise exception 'The drawing''s picture is missing.';
  end if;

  if doodle is null then
    insert into public.studio_doodles (link_id, name, strokes, image, thumb)
    values (link.id, coalesce(studio_save.name, ''), studio_save.strokes, studio_save.image, studio_save.thumb)
    returning id into saved;
  else
    update public.studio_doodles d
    set name = coalesce(studio_save.name, ''),
        strokes = studio_save.strokes,
        image = studio_save.image,
        thumb = studio_save.thumb,
        updated_at = now()
    where d.id = doodle and d.deleted_at is null and (link.owner or d.link_id = link.id)
    returning d.id into saved;
    if saved is null then
      raise exception 'That doodle couldn''t be found.';
    end if;
  end if;
  return saved;
end;
$$;

create or replace function public.studio_delete(key text, doodle uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  update public.studio_doodles d
  set deleted_at = now()
  where d.id = doodle and d.deleted_at is null and (link.owner or d.link_id = link.id);
end;
$$;

-- Everything, full size, for `npm run doodles:pull`. Owner link only.
drop function if exists public.studio_export(text);
create function public.studio_export(key text)
returns table (id uuid, name text, artist text, spot text, strokes jsonb, image text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.studio_links := public.studio_check(key);
begin
  if not link.owner then
    raise exception 'Only the owner link can export doodles.' using errcode = '42501';
  end if;
  return query
    select d.id, d.name, l.label, d.spot, d.strokes, d.image, d.updated_at
    from public.studio_doodles d
    join public.studio_links l on l.id = d.link_id
    where d.deleted_at is null
    order by d.updated_at;
end;
$$;

-- Makes a private link and returns its key. The key is shown once and never stored.
-- Only runs from the SQL editor, never from the site.
create or replace function public.studio_new_link(label text, owner boolean default false)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  secret text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.studio_links (label, key_hash, owner)
  values (studio_new_link.label, encode(sha256(convert_to(secret, 'UTF8')), 'hex'), studio_new_link.owner);
  return secret;
end;
$$;

revoke all on function public.studio_check(text) from public, anon, authenticated;
revoke all on function public.studio_new_link(text, boolean) from public, anon, authenticated;

revoke all on function public.studio_hello(text) from public;
revoke all on function public.studio_accept(text) from public;
revoke all on function public.studio_list(text) from public;
revoke all on function public.studio_get(text, uuid) from public;
revoke all on function public.studio_save(text, uuid, text, jsonb, text, text) from public;
revoke all on function public.studio_delete(text, uuid) from public;
revoke all on function public.studio_assign(text, uuid, text) from public;
revoke all on function public.studio_export(text) from public;
grant execute on function public.studio_hello(text) to anon, authenticated;
grant execute on function public.studio_accept(text) to anon, authenticated;
grant execute on function public.studio_list(text) to anon, authenticated;
grant execute on function public.studio_get(text, uuid) to anon, authenticated;
grant execute on function public.studio_save(text, uuid, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.studio_delete(text, uuid) to anon, authenticated;
grant execute on function public.studio_assign(text, uuid, text) to anon, authenticated;
grant execute on function public.studio_export(text) to anon, authenticated;
