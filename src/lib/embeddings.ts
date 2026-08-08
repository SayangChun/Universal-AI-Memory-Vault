// Embedding provider abstraction.
//
// `none`   -> no embedding calls; search falls back to lexical matching.
// `openai` -> OpenAI text-embedding-3-small (dimension 1536 by default).
//
// Embeddings are best-effort: any failure degrades gracefully to lexical
// search instead of failing the request.

import { getServerEnv } from './env';
import { clamp } from './utils';

const cache = new Map<string, number[]>();

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 6000);
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const env = getServerEnv();
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embedding error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error('OpenAI returned no embedding');
  return embedding;
}

/**
 * Embed text. Returns null when embeddings are disabled/unavailable so the
 * caller can fall back to lexical search.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const env = getServerEnv();
  if (env.embeddingProvider === 'none') return null;

  const normalized = normalizeText(text);
  if (!normalized) return null;

  const key = `${env.embeddingProvider}:${normalized}`;
  if (cache.has(key)) return cache.get(key)!;

  let embedding: number[] | null = null;
  try {
    if (env.embeddingProvider === 'openai') {
      embedding = await embedWithOpenAI(normalized);
    }
  } catch (err) {
    // Best-effort: fall back to lexical search.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[embeddings] failed, falling back to lexical search:', (err as Error).message);
    }
  }

  if (embedding && embedding.length) {
    cache.set(key, embedding);
    if (cache.size > 2000) cache.clear();
  }
  return embedding;
}

/** Serialize an embedding vector for Postgres `vector` column casts (text form). */
export function serializeEmbedding(embedding: number[]): string {
  const env = getServerEnv();
  const dim = env.embeddingDim;
  const trimmed = embedding.slice(0, dim);
  return '[' + trimmed.map((n) => clamp(n, -1, 1).toFixed(6)).join(',') + ']';
}
