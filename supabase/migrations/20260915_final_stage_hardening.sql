-- Arthenis final-stage hardening
-- Keep SECURITY DEFINER helpers internal: they are used by RLS/triggers, not as public RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.initialize_arthenis_world_rules() from public, anon, authenticated;
revoke execute on function public.is_world_editor(uuid) from public, anon, authenticated;
revoke execute on function public.is_world_member(uuid) from public, anon, authenticated;

-- Query-path indexes used by Arthenis world loading and collaboration checks.
create index if not exists worlds_owner_id_idx on public.worlds(owner_id);
create index if not exists worlds_updated_at_idx on public.worlds(updated_at desc);
create index if not exists world_rules_world_id_idx on public.world_rules(world_id);
create index if not exists regions_world_id_idx on public.regions(world_id);
create index if not exists civilizations_world_id_idx on public.civilizations(world_id);
create index if not exists characters_world_id_idx on public.characters(world_id);
create index if not exists creatures_world_id_idx on public.creatures(world_id);
create index if not exists timeline_events_world_day_idx on public.timeline_events(world_id, world_day);
create index if not exists world_members_world_user_idx on public.world_members(world_id, user_id);
create index if not exists creation_proposals_world_created_idx on public.creation_proposals(world_id, created_at desc);
create index if not exists generated_assets_world_entity_idx on public.generated_assets(world_id, entity_type, entity_id);
