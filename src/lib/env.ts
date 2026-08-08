// Server-side environment configuration.
// NEXT_PUBLIC_* values are inlined at build time and safe for the client;
// every other value here is server-only and must never reach the browser.

export function getServerEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
    embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? 'none') as 'none' | 'openai' | 'custom',
    openaiApiKey: process.env.OPENAI_API_KEY,
    embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1536),
    mcpOauthSecret: process.env.MCP_OAUTH_SECRET ?? '',
    mcpServerUrl: process.env.MCP_SERVER_URL ?? '',
    mcpAccessTokenTtl: Number(process.env.MCP_ACCESS_TOKEN_TTL ?? 3600),
    rateLimitRpm: Number(process.env.RATE_LIMIT_RPM ?? 120),
    enableRateLimit: (process.env.ENABLE_RATE_LIMIT ?? 'true') === 'true',
  };
}

export type ServerEnv = ReturnType<typeof getServerEnv>;

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Never fail at import time (so unit tests / static build can run);
    // throw only when the value is actually needed at runtime.
    return '';
  }
  return v;
}

/** Throws when a value that is required for a specific runtime path is missing. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function appUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!u) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_APP_URL (or APP_URL)');
  }
  return u.replace(/\/$/, '');
}

export function mcpServerUrl(): string {
  const url = getServerEnv().mcpServerUrl || `${appUrl()}/api/mcp`;
  return url.replace(/\/$/, '');
}

export function isEmbeddingsEnabled(): boolean {
  return getServerEnv().embeddingProvider !== 'none';
}
