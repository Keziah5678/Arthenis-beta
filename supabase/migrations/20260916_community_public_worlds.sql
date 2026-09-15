-- Community / Explorer screen: public world visibility, likes and follows.
alter table public.worlds add column if not exists is_public boolean not null default false;
alter table public.worlds add column if not exists like_count integer not null default 0;
create index if not exists worlds_is_public_idx on public.worlds(is_public) where is_public;

create table if not exists public.world_likes (
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
create index if not exists world_likes_user_id_idx on public.world_likes(user_id);

create table if not exists public.world_follows (
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
create index if not exists world_follows_user_id_idx on public.world_follows(user_id);

alter table public.world_likes enable row level security;
alter table public.world_follows enable row level security;

-- Users can only see and manage their own like/follow rows. Aggregate counts are
-- exposed publicly through worlds.like_count (kept in sync by trigger below), so
-- broad read access to these join tables is never needed.
drop policy if exists "likes self" on public.world_likes;
create policy "likes self" on public.world_likes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "likes insert" on public.world_likes;
create policy "likes insert" on public.world_likes for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.worlds w where w.id = world_id and (w.is_public or w.owner_id = (select auth.uid()) or (select public.is_world_member(w.id))))
);
drop policy if exists "likes delete" on public.world_likes;
create policy "likes delete" on public.world_likes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "follows self" on public.world_follows;
create policy "follows self" on public.world_follows for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "follows insert" on public.world_follows;
create policy "follows insert" on public.world_follows for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.worlds w where w.id = world_id and (w.is_public or w.owner_id = (select auth.uid()) or (select public.is_world_member(w.id))))
);
drop policy if exists "follows delete" on public.world_follows;
create policy "follows delete" on public.world_follows for delete to authenticated using (user_id = (select auth.uid()));

-- Keep worlds.like_count in sync without exposing world_likes rows publicly.
create or replace function public.sync_world_like_count() returns trigger language plpgsql security definer set search_path = '' as $function$
declare target uuid;
begin
  target := coalesce(NEW.world_id, OLD.world_id);
  update public.worlds set like_count = (select count(*) from public.world_likes where world_id = target) where id = target;
  return null;
end;
$function$;
revoke all on function public.sync_world_like_count() from public, anon, authenticated;

drop trigger if exists world_likes_sync_count on public.world_likes;
create trigger world_likes_sync_count after insert or delete on public.world_likes for each row execute function public.sync_world_like_count();

-- Public worlds become readable (not writable) by any authenticated visitor, in
-- addition to the existing owner/member policy. Postgres OR's permissive policies
-- together, so this only widens read access — it never narrows the existing one.
drop policy if exists "world select public" on public.worlds;
create policy "world select public" on public.worlds for select to authenticated using (is_public = true);

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['regions','civilizations','characters','creatures','timeline_events','world_rules'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', t||' public', t);
    EXECUTE format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.worlds w where w.id = %I.world_id and w.is_public))', t||' public', t, t);
  END LOOP;
END $do$;

-- Creator display names need to be readable by everyone to label community cards;
-- only the owner may still write their own profile row.
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select to authenticated using (true);
