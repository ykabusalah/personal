-- Takes the Doodle Studio out of Supabase for good: every doodle saved in it, every private link,
-- and its functions. Nothing else in the database is touched.
--
-- First run `npm run doodles:pull`. It copies every doodle to your computer (src/art/studio-archive),
-- because this can't be undone.

drop function if exists public.studio_hello(text);
drop function if exists public.studio_accept(text);
drop function if exists public.studio_list(text);
drop function if exists public.studio_get(text, uuid);
drop function if exists public.studio_save(text, uuid, text, jsonb, text, text);
drop function if exists public.studio_delete(text, uuid);
drop function if exists public.studio_assign(text, uuid, text);
drop function if exists public.studio_export(text);
drop function if exists public.studio_new_link(text, boolean);
drop function if exists public.studio_check(text);

drop table if exists public.studio_doodles;
drop table if exists public.studio_links;
