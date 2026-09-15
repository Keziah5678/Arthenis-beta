# Arthenis World Engine

The world engine is the server-side boundary for world evolution, collaboration, rules and creation proposals. It authenticates every request through the Supabase session forwarded in the `Authorization` header and relies on RLS for authorization.

Actions currently supported:
- `advance`: advances the world day and records a coherent timeline event.
- `proposal`: records the coherence decision attached to a creation.
- `member-upsert` / `member-remove`: manages collaborator roles through owner/editor RLS.
- `rule-update`: edits non-immutable world rules only.
- `map` (separate route): builds a coherent map specification from persisted world data.

No service-role key is used by these routes.
