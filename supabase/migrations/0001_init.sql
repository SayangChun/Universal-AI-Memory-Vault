-- ============================================================
-- Universal AI Memory Vault — initial schema
-- Applies to Supabase (PostgreSQL 15+ with pgvector).
-- ============================================================

-- Extensions ---------------------------------------------------
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Enums ---------------------------------------------------------
do $$
begin
  create type memory_type as enum (
    'fact', 'preference', 'habit', 'goal', 'life_event',
    'relationship', 'worldview', 'project', 'temporary', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type memory_status as enum ('active', 'superseded');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type provider as enum ('chatgpt', 'claude', 'gemini', 'other', 'manual', 'api');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type audit_action as enum (
    'create', 'update', 'delete', 'get', 'search', 'list', 'export', 'import'
  );
exception when duplicate_object then null;
end $$;

-- Memories ------------------------------------------------------
create table if not exists memories (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  type                    memory_type not null default 'fact',
  content                 text not null,
  confidence              real not null default 0.8 check (confidence between 0 and 1),
  importance              real not null default 0.6 check (importance between 0 and 1),
  status                  memory_status not null default 'active',
  source                  text not null default 'conversation',
  source_provider         provider not null default 'manual',
  source_conversation_id  text,
  updated_by_provider     provider,
  meta                    jsonb not null default '{}'::jsonb,
  embedding               vector(1536),
  supersedes_memory_id    uuid references memories (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  last_accessed_at        timestamptz
);

create index if not exists memories_user_updated_idx
  on memories (user_id, updated_at desc);
create index if not exists memories_user_type_idx
  on memories (user_id, type);
create index if not exists memories_user_importance_idx
  on memories (user_id, importance desc);
create index if not exists memories_content_trgm_idx
  on memories using gin (content gin_trgm_ops);
create index if not exists memories_embedding_hnsw_idx
  on memories using hnsw (embedding vector_cosine_ops);

-- Memory version history ---------------------------------------
create table if not exists memory_versions (
  id                   uuid primary key default gen_random_uuid(),
  memory_id            uuid not null references memories (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  version_number       int not null,
  content              text not null,
  type                 memory_type not null,
  confidence           real,
  importance           real,
  changed_by_provider  provider,
  created_at           timestamptz not null default now(),
  unique (memory_id, version_number)
);

create index if not exists memory_versions_memory_idx
  on memory_versions (memory_id, version_number desc);
create index if not exists memory_versions_user_idx
  on memory_versions (user_id);

-- Audit log -----------------------------------------------------
-- No FK to memories so audit entries survive memory deletion.
create table if not exists audit_logs (
  id               bigserial primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  memory_id        uuid,
  action           audit_action not null,
  source_provider  provider not null default 'manual',
  detail           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists audit_logs_user_idx
  on audit_logs (user_id, created_at desc);
create index if not exists audit_logs_memory_idx
  on audit_logs (memory_id, created_at desc);

-- AI platform integrations (per user) ---------------------------
create table if not exists ai_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  provider        provider not null,
  name            text not null,
  status          text not null default 'connected',
  credential_type text not null default 'mcp_oauth',
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists ai_integrations_user_idx on ai_integrations (user_id);

-- Personal MCP access tokens (programmatic / stdio clients) ----
create table if not exists mcp_access_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  integration_id  uuid references ai_integrations (id) on delete set null,
  name            text not null,
  token_hash      text not null unique,
  token_prefix    text not null,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);

create index if not exists mcp_access_tokens_user_idx on mcp_access_tokens (user_id);

-- OAuth 2.0 authorization server tables ------------------------
create table if not exists mcp_oauth_clients (
  client_id                      text primary key,
  client_secret_hash             text,
  client_name                    text,
  client_uri                     text,
  redirect_uris                  jsonb not null default '[]'::jsonb,
  grant_types                    jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  response_types                 jsonb not null default '["code"]'::jsonb,
  token_endpoint_auth_method     text not null default 'none',
  provider                       provider,
  created_at                     timestamptz not null default now()
);

create table if not exists mcp_oauth_codes (
  code_hash        text primary key,
  user_id          uuid not null,
  client_id        text not null,
  redirect_uri     text not null,
  code_challenge   text not null,
  scopes           jsonb not null default '["mcp"]'::jsonb,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists mcp_oauth_tokens (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  client_id           text not null,
  provider            provider,
  scopes              jsonb not null default '["mcp"]'::jsonb,
  refresh_token_hash  text not null unique,
  access_jti          text,
  expires_at          timestamptz,
  last_used_at        timestamptz,
  created_at          timestamptz not null default now(),
  revoked_at          timestamptz
);

create index if not exists mcp_oauth_tokens_user_idx on mcp_oauth_tokens (user_id);
create index if not exists mcp_oauth_tokens_client_idx on mcp_oauth_tokens (client_id);

-- updated_at trigger -------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists memories_set_updated_at on memories;
create trigger memories_set_updated_at
  before update on memories
  for each row execute function set_updated_at();

drop trigger if exists ai_integrations_set_updated_at on ai_integrations;
create trigger ai_integrations_set_updated_at
  before update on ai_integrations
  for each row execute function set_updated_at();

-- Row Level Security -------------------------------------------
alter table memories enable row level security;
alter table memory_versions enable row level security;
alter table audit_logs enable row level security;
alter table ai_integrations enable row level security;
alter table mcp_access_tokens enable row level security;
alter table mcp_oauth_clients enable row level security;
alter table mcp_oauth_codes enable row level security;
alter table mcp_oauth_tokens enable row level security;

-- User-owned tables: owner access only.
drop policy if exists memories_owner on memories;
create policy memories_owner on memories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists memory_versions_owner on memory_versions;
create policy memory_versions_owner on memory_versions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists audit_logs_owner on audit_logs;
create policy audit_logs_owner on audit_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_integrations_owner on ai_integrations;
create policy ai_integrations_owner on ai_integrations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists mcp_access_tokens_owner on mcp_access_tokens;
create policy mcp_access_tokens_owner on mcp_access_tokens
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- OAuth tables: deny all direct access (server-side, service-role only).
drop policy if exists oauth_clients_none on mcp_oauth_clients;
create policy oauth_clients_none on mcp_oauth_clients for all to authenticated using (false) with check (false);
drop policy if exists oauth_codes_none on mcp_oauth_codes;
create policy oauth_codes_none on mcp_oauth_codes for all to authenticated using (false) with check (false);
drop policy if exists oauth_tokens_none on mcp_oauth_tokens;
create policy oauth_tokens_none on mcp_oauth_tokens for all to authenticated using (false) with check (false);

-- ============================================================
-- RPC functions (single code path used by REST API + MCP tools)
-- All functions take an explicit p_user_id and are called with the
-- server-side service role key. RLS stays on as defense in depth.
-- ============================================================

-- memory_create --------------------------------------------------
create or replace function memory_create(
  p_user_id              uuid,
  p_content              text,
  p_type                 text default 'fact',
  p_confidence           real default 0.8,
  p_importance           real default 0.6,
  p_source               text default 'conversation',
  p_source_provider      text default 'manual',
  p_source_conversation_id text default null,
  p_meta                 jsonb default '{}'::jsonb,
  p_embedding            text default null,
  p_supersedes           uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_first uuid;
begin
  insert into memories (
    user_id, type, content, confidence, importance, source,
    source_provider, source_conversation_id, meta, embedding, supersedes_memory_id
  ) values (
    p_user_id,
    p_type::memory_type,
    p_content,
    p_confidence,
    p_importance,
    p_source,
    p_source_provider::provider,
    p_source_conversation_id,
    coalesce(p_meta, '{}'::jsonb),
    case when p_embedding is not null then p_embedding::vector end,
    (select t from unnest(coalesce(p_supersedes, array[]::uuid[])) t limit 1)
  )
  returning id into v_id;

  insert into memory_versions (
    memory_id, user_id, version_number, content, type, confidence, importance, changed_by_provider
  ) values (
    v_id, p_user_id, 1, p_content, p_type::memory_type, p_confidence, p_importance, p_source_provider::provider
  );

  if p_supersedes is not null and array_length(p_supersedes, 1) > 0 then
    update memories
      set status = 'superseded', updated_at = now()
      where user_id = p_user_id and id = any (p_supersedes) and id <> v_id;
  end if;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (
    p_user_id, v_id, 'create', p_source_provider::provider,
    jsonb_build_object('type', p_type, 'supersedes', p_supersedes)
  );

  return memory_get(p_user_id, v_id, p_source_provider);
end $$;

-- memory_update --------------------------------------------------
create or replace function memory_update(
  p_user_id     uuid,
  p_memory_id   uuid,
  p_content     text default null,
  p_type        text default null,
  p_confidence  real default null,
  p_importance  real default null,
  p_provider    text default 'manual',
  p_embedding   text default null,
  p_meta        jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur memories%rowtype;
  v_new_version int;
  v_final_content text;
  v_final_type memory_type;
  v_final_conf real;
  v_final_imp real;
begin
  select * into v_cur from memories where id = p_memory_id and user_id = p_user_id for update;
  if v_cur is null then
    return null;
  end if;

  v_final_content := coalesce(p_content, v_cur.content);
  v_final_type    := coalesce(p_type::memory_type, v_cur.type);
  v_final_conf    := coalesce(p_confidence, v_cur.confidence);
  v_final_imp     := coalesce(p_importance, v_cur.importance);

  -- Only create a new version when the content actually changed.
  if v_final_content is distinct from v_cur.content then
    v_new_version := coalesce(
      (select max(version_number) from memory_versions where memory_id = p_memory_id), 0
    ) + 1;
    insert into memory_versions (
      memory_id, user_id, version_number, content, type, confidence, importance, changed_by_provider
    ) values (
      p_memory_id, p_user_id, v_new_version, v_final_content, v_final_type,
      v_final_conf, v_final_imp, p_provider::provider
    );
  else
    v_new_version := coalesce(
      (select max(version_number) from memory_versions where memory_id = p_memory_id), 1
    );
  end if;

  update memories set
    content             = v_final_content,
    type                = v_final_type,
    confidence          = v_final_conf,
    importance          = v_final_imp,
    embedding           = case when p_embedding is not null then p_embedding::vector else embedding end,
    meta                = coalesce(p_meta, meta),
    updated_by_provider = p_provider::provider,
    updated_at          = now()
  where id = p_memory_id and user_id = p_user_id;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, p_memory_id, 'update', p_provider::provider,
          jsonb_build_object('version', v_new_version));

  return memory_get(p_user_id, p_memory_id, p_provider);
end $$;

-- memory_delete --------------------------------------------------
create or replace function memory_delete(
  p_user_id    uuid,
  p_memory_id  uuid,
  p_provider   text default 'manual'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text;
begin
  select content into v_content from memories where id = p_memory_id and user_id = p_user_id;
  if v_content is null then
    return false;
  end if;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, p_memory_id, 'delete', p_provider::provider,
          jsonb_build_object('content_preview', left(v_content, 200)));

  delete from memories where id = p_memory_id and user_id = p_user_id;
  return true;
end $$;

-- memory_get -----------------------------------------------------
create or replace function memory_get(
  p_user_id    uuid,
  p_memory_id  uuid,
  p_provider   text default 'manual'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mem jsonb;
  v_versions jsonb;
  v_audit jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'user_id', m.user_id,
    'type', m.type,
    'content', m.content,
    'confidence', m.confidence,
    'importance', m.importance,
    'status', m.status,
    'source', m.source,
    'source_provider', m.source_provider,
    'source_conversation_id', m.source_conversation_id,
    'updated_by_provider', m.updated_by_provider,
    'meta', m.meta,
    'supersedes_memory_id', m.supersedes_memory_id,
    'created_at', m.created_at,
    'updated_at', m.updated_at,
    'last_accessed_at', m.last_accessed_at,
    'version_number', (select max(v.version_number) from memory_versions v where v.memory_id = m.id)
  ) into v_mem
  from memories m
  where m.id = p_memory_id and m.user_id = p_user_id;

  if v_mem is null then
    return null;
  end if;

  update memories set last_accessed_at = now()
  where id = p_memory_id and user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'version_number', v.version_number,
    'content', v.content,
    'type', v.type,
    'confidence', v.confidence,
    'importance', v.importance,
    'changed_by_provider', v.changed_by_provider,
    'created_at', v.created_at
  ) order by v.version_number desc), '[]'::jsonb) into v_versions
  from memory_versions v
  where v.memory_id = p_memory_id and v.user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'action', a.action,
    'source_provider', a.source_provider,
    'detail', a.detail,
    'created_at', a.created_at
  ) order by a.created_at desc), '[]'::jsonb) into v_audit
  from audit_logs a
  where a.memory_id = p_memory_id and a.user_id = p_user_id;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, p_memory_id, 'get', p_provider::provider, '{}'::jsonb);

  return v_mem || jsonb_build_object('versions', v_versions, 'audit', v_audit);
end $$;

-- memory_list ----------------------------------------------------
create or replace function memory_list(
  p_user_id   uuid,
  p_type      text default null,
  p_limit     int default 50,
  p_offset    int default 0,
  p_sort      text default 'updated'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_results jsonb;
begin
  if p_limit < 1 then p_limit := 50; end if;
  if p_limit > 200 then p_limit := 200; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'type', m.type,
    'content', m.content,
    'confidence', m.confidence,
    'importance', m.importance,
    'status', m.status,
    'source', m.source,
    'source_provider', m.source_provider,
    'source_conversation_id', m.source_conversation_id,
    'created_at', m.created_at,
    'updated_at', m.updated_at,
    'last_accessed_at', m.last_accessed_at,
    'version_number', (select max(v.version_number) from memory_versions v where v.memory_id = m.id)
  ) order by
    case p_sort when 'created' then m.created_at end desc,
    case p_sort when 'accessed' then m.last_accessed_at end desc nulls last,
    m.updated_at desc), '[]'::jsonb) into v_results
  from (
    select *
    from memories m2
    where m2.user_id = p_user_id
      and (p_type is null or m2.type::text = p_type)
    order by
      case p_sort when 'created' then m2.created_at end desc,
      case p_sort when 'accessed' then m2.last_accessed_at end desc nulls last,
      m2.updated_at desc
    limit p_limit offset p_offset
  ) m;

  return v_results;
end $$;

-- memory_search ---------------------------------------------------
create or replace function memory_search(
  p_user_id          uuid,
  p_query            text default null,
  p_type             text default null,
  p_limit            int default 8,
  p_embedding        text default null,
  p_provider         text default 'manual',
  p_min_importance   real default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_embedding vector(1536);
  v_results jsonb;
  v_count int;
begin
  if p_limit < 1 then p_limit := 8; end if;
  if p_limit > 20 then p_limit := 20; end if;

  if p_embedding is not null and p_embedding <> '' then
    v_embedding := p_embedding::vector;
  end if;

  with scored as (
    select m.*,
      case
        when v_embedding is not null then
          greatest(0, 1 - (m.embedding <=> v_embedding)) * 2
            + m.importance + (case when m.last_accessed_at is not null then 0.05 else 0 end)
        when p_query is not null and p_query <> '' then
          similarity(m.content, p_query) * 2
            + (case when m.content ilike '%' || p_query || '%' then 1 else 0 end)
            + m.importance * 0.5
        else
          m.importance
      end as score
    from memories m
    where m.user_id = p_user_id
      and m.status = 'active'
      and m.importance >= p_min_importance
      and (p_type is null or m.type::text = p_type)
      and (
        v_embedding is not null
        or p_query is null or p_query = ''
        or m.content ilike '%' || p_query || '%'
        or similarity(m.content, p_query) > 0.1
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'type', s.type,
    'content', s.content,
    'confidence', s.confidence,
    'importance', s.importance,
    'status', s.status,
    'source', s.source,
    'source_provider', s.source_provider,
    'source_conversation_id', s.source_conversation_id,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'last_accessed_at', s.last_accessed_at,
    'score', round(s.score::numeric, 4)
  ) order by s.score desc, s.importance desc, s.updated_at desc), '[]'::jsonb) into v_results
  from scored s;

  v_count := jsonb_array_length(v_results);

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, null, 'search', p_provider::provider,
          jsonb_build_object('query', p_query, 'result_count', v_count, 'limit', p_limit));

  return v_results;
end $$;

-- memory_stats ----------------------------------------------------
create or replace function memory_stats(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_by_type jsonb;
  v_recent jsonb;
  v_recent_updates jsonb;
begin
  select count(*) into v_total from memories where user_id = p_user_id;

  select coalesce(jsonb_object_agg(type::text, cnt), '{}'::jsonb) into v_by_type
  from (
    select type, count(*) as cnt from memories where user_id = p_user_id group by type
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'type', m.type, 'content', m.content,
    'importance', m.importance, 'updated_at', m.updated_at
  ) order by m.updated_at desc), '[]'::jsonb) into v_recent
  from memories m where m.user_id = p_user_id limit 8;

  select coalesce(jsonb_agg(jsonb_build_object(
    'memory_id', a.memory_id, 'action', a.action, 'source_provider', a.source_provider,
    'created_at', a.created_at, 'detail', a.detail
  ) order by a.created_at desc), '[]'::jsonb) into v_recent_updates
  from audit_logs a where a.user_id = p_user_id limit 12;

  return jsonb_build_object(
    'total', v_total,
    'by_type', v_by_type,
    'recent_memories', v_recent,
    'recent_updates', v_recent_updates
  );
end $$;

-- memory_export ---------------------------------------------------
create or replace function memory_export(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'type', m.type,
    'content', m.content,
    'confidence', m.confidence,
    'importance', m.importance,
    'status', m.status,
    'source', m.source,
    'source_provider', m.source_provider,
    'source_conversation_id', m.source_conversation_id,
    'meta', m.meta,
    'supersedes_memory_id', m.supersedes_memory_id,
    'created_at', m.created_at,
    'updated_at', m.updated_at,
    'versions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'version_number', v.version_number, 'content', v.content, 'type', v.type,
        'confidence', v.confidence, 'importance', v.importance,
        'changed_by_provider', v.changed_by_provider, 'created_at', v.created_at
      ) order by v.version_number), '[]'::jsonb)
      from memory_versions v where v.memory_id = m.id
    )
  ) order by m.created_at), '[]'::jsonb) into v_items
  from memories m
  where m.user_id = p_user_id;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, null, 'export', 'manual', jsonb_build_object('count', jsonb_array_length(v_items)));

  return v_items;
end $$;

-- memory_import_batch ---------------------------------------------
create or replace function memory_import_batch(
  p_user_id   uuid,
  p_items     jsonb,
  p_provider  text default 'manual'
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_count int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a jsonb array';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'content' and jsonb_typeof(v_item->'content') = 'string' and length(v_item->>'content') > 0 then
      insert into memories (
        user_id, type, content, confidence, importance, status, source,
        source_provider, source_conversation_id, meta, created_at, updated_at
      ) values (
        p_user_id,
        coalesce(nullif(v_item->>'type', ''), 'fact')::memory_type,
        v_item->>'content',
        coalesce((v_item->>'confidence')::real, 0.8),
        coalesce((v_item->>'importance')::real, 0.6),
        coalesce(nullif(v_item->>'status', ''), 'active')::memory_status,
        coalesce(nullif(v_item->>'source', ''), 'import'),
        coalesce(nullif(v_item->>'source_provider', ''), 'manual')::provider,
        v_item->>'source_conversation_id',
        coalesce(v_item->'meta', '{}'::jsonb),
        coalesce((v_item->>'created_at')::timestamptz, now()),
        coalesce((v_item->>'updated_at')::timestamptz, now())
      )
      returning id into v_id;

      insert into memory_versions (
        memory_id, user_id, version_number, content, type, confidence, importance, changed_by_provider, created_at
      ) values (
        v_id, p_user_id, 1, v_item->>'content',
        coalesce(nullif(v_item->>'type', ''), 'fact')::memory_type,
        coalesce((v_item->>'confidence')::real, 0.8),
        coalesce((v_item->>'importance')::real, 0.6),
        'manual',
        coalesce((v_item->>'created_at')::timestamptz, now())
      );

      v_count := v_count + 1;
    end if;
  end loop;

  insert into audit_logs (user_id, memory_id, action, source_provider, detail)
  values (p_user_id, null, 'import', p_provider::provider, jsonb_build_object('count', v_count));

  return v_count;
end $$;

-- memory_delete_all ------------------------------------------------
-- Hard deletes every row owned by the user (privacy: full wipe).
create or replace function memory_delete_all(p_user_id uuid, p_provider text default 'manual') returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from memories where user_id = p_user_id;
  delete from memories where user_id = p_user_id;
  delete from ai_integrations where user_id = p_user_id;
  delete from mcp_access_tokens where user_id = p_user_id;
  delete from mcp_oauth_tokens where user_id = p_user_id;
  delete from audit_logs where user_id = p_user_id;
  return v_count;
end $$;

-- Grant execute to the roles used by the REST API / MCP server. -----
-- (service_role bypasses RLS and can call these; `authenticated` is the
--  regular Supabase client role — memory_* functions still check user_id.)
grant execute on function
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
to authenticated, service_role;
