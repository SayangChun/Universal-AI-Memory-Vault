-- OAuth authorization server — PAR + access-token revocation tables.
-- Added separately so 0001_init.sql stays focused on the memory schema.

create table if not exists mcp_oauth_par (
  request_uri      text primary key,
  request_uri_hash text not null unique,
  params           jsonb not null,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);

create table if not exists mcp_oauth_revoked_jti (
  jti        text primary key,
  client_id  text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table mcp_oauth_par enable row level security;
alter table mcp_oauth_revoked_jti enable row level security;

-- No direct access for authenticated clients; server-side (service role) only.
drop policy if exists oauth_par_none on mcp_oauth_par;
create policy oauth_par_none on mcp_oauth_par for all to authenticated using (false) with check (false);
drop policy if exists oauth_revoked_none on mcp_oauth_revoked_jti;
create policy oauth_revoked_none on mcp_oauth_revoked_jti for all to authenticated using (false) with check (false);
