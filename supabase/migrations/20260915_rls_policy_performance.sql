-- Optimize Arthenis RLS evaluation and keep the API surface authenticated-only.
-- Membership helpers are SECURITY DEFINER and intentionally remain callable by RLS.
alter table public.profiles enable row level security;
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;
alter table public.world_rules enable row level security;
alter table public.regions enable row level security;
alter table public.civilizations enable row level security;
alter table public.characters enable row level security;
alter table public.creatures enable row level security;
alter table public.timeline_events enable row level security;
alter table public.creation_proposals enable row level security;
alter table public.generated_assets enable row level security;

-- Replace policies with SELECT checks that initialize auth.uid() once per statement.
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for all to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists "world delete" on public.worlds;
drop policy if exists "world insert" on public.worlds;
drop policy if exists "world select" on public.worlds;
drop policy if exists "world update" on public.worlds;
create policy "world insert" on public.worlds for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "world select" on public.worlds for select to authenticated using (owner_id=(select auth.uid()) or (select public.is_world_member(id)));
create policy "world update" on public.worlds for update to authenticated using (owner_id=(select auth.uid()) or (select public.is_world_editor(id))) with check (owner_id=(select auth.uid()) or (select public.is_world_editor(id)));
create policy "world delete" on public.worlds for delete to authenticated using (owner_id=(select auth.uid()));

-- Entity tables: one member-read policy and one editor mutation policy avoids overlapping permissive SELECT policies.
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['regions','civilizations','characters','creatures','timeline_events','world_rules','creation_proposals','generated_assets'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', CASE t WHEN 'regions' THEN 'regions member' WHEN 'civilizations' THEN 'civilizations member' WHEN 'characters' THEN 'characters member' WHEN 'creatures' THEN 'creatures member' WHEN 'timeline_events' THEN 'timeline member' WHEN 'world_rules' THEN 'rules member' WHEN 'creation_proposals' THEN 'proposals member' ELSE 'assets member' END, t);
    EXECUTE format('drop policy if exists %I on public.%I', CASE t WHEN 'regions' THEN 'regions editor' WHEN 'civilizations' THEN 'civilizations editor' WHEN 'characters' THEN 'characters editor' WHEN 'creatures' THEN 'creatures editor' WHEN 'timeline_events' THEN 'timeline editor' WHEN 'world_rules' THEN 'rules editor' WHEN 'creation_proposals' THEN 'proposals editor' ELSE 'assets editor' END, t);
    EXECUTE format('create policy %I on public.%I for select to authenticated using ((select public.is_world_member(world_id)))', t||' member', t);
    EXECUTE format('create policy %I on public.%I for all to authenticated using ((select public.is_world_editor(world_id))) with check ((select public.is_world_editor(world_id)))', t||' editor', t);
  END LOOP;
END $do$;

DROP POLICY IF EXISTS "members member" ON public.world_members;
DROP POLICY IF EXISTS "members owner" ON public.world_members;
CREATE POLICY "members member" ON public.world_members FOR SELECT TO authenticated USING ((select public.is_world_member(world_id)));
CREATE POLICY "members owner" ON public.world_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.worlds w WHERE w.id=world_members.world_id AND w.owner_id=(select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.worlds w WHERE w.id=world_members.world_id AND w.owner_id=(select auth.uid())));
