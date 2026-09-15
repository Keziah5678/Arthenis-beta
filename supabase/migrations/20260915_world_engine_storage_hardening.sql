create or replace function public.advance_world_day(p_world uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare current_day integer; next_day integer;
begin
  if not exists (
    select 1 from public.worlds w where w.id=p_world and w.owner_id=(select auth.uid())
    union all
    select 1 from public.world_members m where m.world_id=p_world and m.user_id=(select auth.uid()) and m.role in ('admin','creator')
  ) then raise exception 'forbidden'; end if;
  select greatest(1, coalesce((world_memory->>'day')::integer,1)) into current_day from public.worlds where id=p_world for update;
  if current_day is null then raise exception 'world_not_found'; end if;
  next_day:=current_day+1;
  update public.worlds set world_memory=jsonb_set(coalesce(world_memory,'{}'::jsonb),'{day}',to_jsonb(next_day),true),updated_at=now() where id=p_world;
  return next_day;
end;
$$;
revoke all on function public.advance_world_day(uuid) from anon, authenticated;
grant execute on function public.advance_world_day(uuid) to authenticated;

insert into storage.buckets(id,name,public)
values('arthenis-assets','arthenis-assets',false)
on conflict (id) do nothing;

drop policy if exists "arthenis assets read" on storage.objects;
drop policy if exists "arthenis assets insert" on storage.objects;
drop policy if exists "arthenis assets update" on storage.objects;
drop policy if exists "arthenis assets delete" on storage.objects;
create policy "arthenis assets read" on storage.objects for select to authenticated using (
 bucket_id='arthenis-assets' and exists (select 1 from public.worlds w where w.id=split_part(name,'/',1)::uuid and w.owner_id=(select auth.uid()) union all select 1 from public.world_members m where m.world_id=split_part(name,'/',1)::uuid and m.user_id=(select auth.uid()))
);
create policy "arthenis assets insert" on storage.objects for insert to authenticated with check (
 bucket_id='arthenis-assets' and exists (select 1 from public.worlds w where w.id=split_part(name,'/',1)::uuid and w.owner_id=(select auth.uid()) union all select 1 from public.world_members m where m.world_id=split_part(name,'/',1)::uuid and m.user_id=(select auth.uid()) and m.role in ('admin','creator','contributor'))
);
create policy "arthenis assets update" on storage.objects for update to authenticated using (
 bucket_id='arthenis-assets' and exists (select 1 from public.worlds w where w.id=split_part(name,'/',1)::uuid and w.owner_id=(select auth.uid()) union all select 1 from public.world_members m where m.world_id=split_part(name,'/',1)::uuid and m.user_id=(select auth.uid()) and m.role in ('admin','creator','contributor'))
) with check (bucket_id='arthenis-assets');
create policy "arthenis assets delete" on storage.objects for delete to authenticated using (
 bucket_id='arthenis-assets' and exists (select 1 from public.worlds w where w.id=split_part(name,'/',1)::uuid and w.owner_id=(select auth.uid()) union all select 1 from public.world_members m where m.world_id=split_part(name,'/',1)::uuid and m.user_id=(select auth.uid()) and m.role in ('admin','creator'))
);
