create or replace function public.advance_world_day(p_world uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_day integer;
  next_day integer;
begin
  if not exists (
    select 1 from public.worlds w where w.id=p_world and w.owner_id=(select auth.uid())
    union all
    select 1 from public.world_members m where m.world_id=p_world and m.user_id=(select auth.uid()) and m.role in ('owner','admin','creator','contributor')
  ) then
    raise exception 'forbidden';
  end if;
  select greatest(1, coalesce((world_memory->>'day')::integer,1)) into current_day
  from public.worlds where id=p_world for update;
  if current_day is null then raise exception 'world_not_found'; end if;
  next_day := current_day + 1;
  update public.worlds
  set world_memory = jsonb_set(coalesce(world_memory,'{}'::jsonb), '{day}', to_jsonb(next_day), true), updated_at=now()
  where id=p_world;
  return next_day;
end;
$function$;

create or replace function public.can_manage_world_members(p_world uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.worlds w where w.id=p_world and w.owner_id=(select auth.uid())
    union all
    select 1 from public.world_members m where m.world_id=p_world and m.user_id=(select auth.uid()) and m.role='admin'
  );
$function$;

revoke all on function public.advance_world_day(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_world_members(uuid) from public, anon, authenticated;
grant execute on function public.advance_world_day(uuid) to authenticated;
grant execute on function public.can_manage_world_members(uuid) to authenticated;
