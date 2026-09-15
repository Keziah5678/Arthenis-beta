-- RLS policies execute these SECURITY DEFINER helpers on behalf of authenticated users.
-- Keep them unavailable to anonymous users while allowing authenticated RLS evaluation.
revoke execute on function public.is_world_member(uuid) from public, anon;
revoke execute on function public.is_world_editor(uuid) from public, anon;
grant execute on function public.is_world_member(uuid) to authenticated;
grant execute on function public.is_world_editor(uuid) to authenticated;
