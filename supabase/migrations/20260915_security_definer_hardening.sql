-- Harden existing SECURITY DEFINER functions used by RLS and auth triggers.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.initialize_arthenis_world_rules() returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  insert into public.world_rules(world_id,category,title,description,importance,immutable)
  values
    (new.id,'world','Thème','Le monde respecte le thème et l’époque définis par son créateur.',5,true),
    (new.id,'fiction','Fiction',case when new.fiction_enabled then 'La fiction est autorisée, sous réserve de cohérence avec le monde.' else 'La fiction est interdite.' end,5,true),
    (new.id,'creatures','Créatures fictives',case when new.fictional_creatures_enabled then 'Les créatures fictives sont autorisées si elles restent cohérentes avec le monde.' else 'Les créatures fictives sont interdites.' end,5,true),
    (new.id,'magic','Magie',case when new.magic_enabled then 'La magie est autorisée et doit suivre des règles cohérentes.' else 'La magie est interdite.' end,5,true);
  return new;
end;
$function$;

create or replace function public.is_world_editor(p_world uuid) returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.worlds w where w.id=p_world and w.owner_id=(select auth.uid())
    union all
    select 1 from public.world_members m where m.world_id=p_world and m.user_id=(select auth.uid()) and m.role in ('owner','admin','creator','contributor')
  );
$function$;

create or replace function public.is_world_member(p_world uuid) returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.worlds w where w.id=p_world and w.owner_id=(select auth.uid())
    union all
    select 1 from public.world_members m where m.world_id=p_world and m.user_id=(select auth.uid())
  );
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.initialize_arthenis_world_rules() from public, anon, authenticated;
revoke execute on function public.is_world_editor(uuid) from public, anon, authenticated;
revoke execute on function public.is_world_member(uuid) from public, anon, authenticated;
