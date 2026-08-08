-- ============================================================
-- Universal AI Memory Vault — remove the account system
-- The platform is now single-user with no Supabase Auth. The app
-- always acts as one fixed owner (see SINGLE_USER_ID env), so the
-- user_id columns no longer reference auth.users and RLS is disabled.
-- ============================================================

-- Drop FK constraints to auth.users on every table.
alter table memories drop constraint if exists memories_user_id_fkey;
alter table memory_versions drop constraint if exists memory_versions_user_id_fkey;
alter table audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table ai_integrations drop constraint if exists ai_integrations_user_id_fkey;
alter table mcp_access_tokens drop constraint if exists mcp_access_tokens_user_id_fkey;
alter table mcp_oauth_tokens drop constraint if exists mcp_oauth_tokens_user_id_fkey;

-- RLS was keyed to auth.uid(), which no longer exists. The app talks to
-- Postgres exclusively with the service-role key, so RLS is dropped.
alter table memories disable row level security;
alter table memory_versions disable row level security;
alter table audit_logs disable row level security;
alter table ai_integrations disable row level security;
alter table mcp_access_tokens disable row level security;
alter table mcp_oauth_clients disable row level security;
alter table mcp_oauth_codes disable row level security;
alter table mcp_oauth_tokens disable row level security;
alter table mcp_oauth_par disable row level security;
alter table mcp_oauth_revoked_jti disable row level security;

-- RPC functions are still invoked with the service-role key; drop the
-- now-pointless `authenticated` grant.
revoke execute on function
  memory_create(uuid, text, text, real, real, text, text, text, jsonb, text, uuid[]),
  memory_update(uuid, uuid, text, text, real, real, text, text, jsonb),
  memory_delete(uuid, uuid, text),
  memory_get(uuid, uuid, text),
  memory_list(uuid, text, int, int, text),
  memory_search(uuid, text, text, int, text, text, real),
  memory_stats(uuid),
  memory_export(uuid),
  memory_import_batch(uuid, jsonb, text),
  memory_delete_all(uuid, text)
from authenticated;
