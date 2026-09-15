-- One membership row per user per world. This also supports atomic upserts from the collaboration engine.
drop index if exists public.world_members_world_user_idx;
create unique index world_members_world_user_idx on public.world_members(world_id, user_id);
