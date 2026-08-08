// Zod schemas for every input surface (REST API bodies and MCP tool args).
// These double as the MCP tool input schemas (Standard Schema compatible).
import { z } from 'zod';
import { MEMORY_TYPES, PROVIDERS, type Provider } from './types';

export const memoryTypeSchema = z.enum(MEMORY_TYPES);
export const providerSchema = z.enum(PROVIDERS);

const contentSchema = z
  .string()
  .min(1, 'content is required')
  .max(5000, 'content must be at most 5000 characters');

const confidenceSchema = z.number().min(0).max(1);
const importanceSchema = z.number().min(0).max(1);

export const memoryCreateSchema = z.object({
  content: contentSchema,
  type: memoryTypeSchema.default('fact'),
  confidence: confidenceSchema.default(0.8),
  importance: importanceSchema.default(0.6),
  source: z.string().max(100).optional(),
  source_provider: providerSchema.optional(),
  source_conversation_id: z.string().max(500).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  supersedes: z.array(z.string().uuid()).max(20).optional(),
});

export const memoryUpdateSchema = z
  .object({
    content: contentSchema.optional(),
    type: memoryTypeSchema.optional(),
    confidence: confidenceSchema.optional(),
    importance: importanceSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field to update is required' });

export const memorySearchSchema = z.object({
  query: z.string().max(2000).optional().default(''),
  type: memoryTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  min_importance: z.coerce.number().min(0).max(1).optional().default(0),
});

export const memoryListSchema = z.object({
  type: memoryTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['updated', 'created', 'accessed']).default('updated'),
});

export const memoryDeleteSchema = z.object({
  confirm: z.literal('DELETE'),
});

export const importSchema = z.object({
  items: z
    .array(
      z.object({
        type: memoryTypeSchema.optional().default('fact'),
        content: contentSchema,
        confidence: confidenceSchema.optional(),
        importance: importanceSchema.optional(),
        status: z.enum(['active', 'superseded']).optional(),
        source: z.string().max(100).optional(),
        source_provider: providerSchema.optional(),
        source_conversation_id: z.string().max(500).nullable().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      }),
    )
    .min(1, 'items must not be empty')
    .max(2000, 'too many items (max 2000)'),
});

export const accessTokenCreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: providerSchema.optional(),
});

// ---- MCP tool input schemas (also used by the REST API where relevant) ----

export const mcpSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'query is required')
    .max(2000, 'query too long')
    .describe('The question or topic to search the user’s long-term memory about'),
  type: memoryTypeSchema
    .optional()
    .describe('Restrict results to one memory type (fact, preference, goal, ...)'),
  limit: z.coerce.number().int().min(1).max(20).default(8).describe('Max results (1-20, default 8)'),
});

export const mcpGetSchema = z.object({
  memory_id: z.string().uuid().describe('The id of the memory to read'),
});

export const mcpCreateSchema = z.object({
  content: contentSchema.describe('The memory content to save (facts, preferences, goals, etc.)'),
  type: memoryTypeSchema.default('fact').describe('Category of this memory'),
  confidence: confidenceSchema.default(0.8).describe('How confident the AI is in this memory (0-1)'),
  importance: importanceSchema.default(0.6).describe('How important this memory is (0-1)'),
  source_conversation_id: z
    .string()
    .max(500)
    .optional()
    .describe('Id of the conversation this memory came from'),
  supersedes: z
    .array(z.string().uuid())
    .max(20)
    .optional()
    .describe('Ids of older memories this new memory replaces (conflict resolution)'),
});

export const mcpUpdateSchema = z.object({
  memory_id: z.string().uuid().describe('The id of the memory to update'),
  content: contentSchema.describe('The new content. If the meaning changed, update instead of creating a duplicate'),
  type: memoryTypeSchema.optional().describe('New category (optional)'),
  confidence: confidenceSchema.optional().describe('New confidence (optional)'),
  importance: importanceSchema.optional().describe('New importance (optional)'),
});

export const mcpDeleteSchema = z.object({
  memory_id: z.string().uuid().describe('The id of the memory to delete'),
  confirm: z
    .literal('DELETE')
    .describe('Required. Only set to "DELETE" when the user explicitly asked to delete this memory'),
  reason: z.string().max(500).optional().describe('Optional explanation for the deletion'),
});

export type MemoryCreateInput = z.infer<typeof memoryCreateSchema>;
export type MemoryUpdateInput = z.infer<typeof memoryUpdateSchema>;
export type MemorySearchInput = z.infer<typeof memorySearchSchema>;

/** Coerce + validate a provider string, defaulting to 'other'. */
export function parseProvider(p: unknown): Provider {
  const r = providerSchema.safeParse(p);
  return r.success ? r.data : 'other';
}
