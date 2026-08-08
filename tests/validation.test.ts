import { describe, it, expect } from 'vitest';
import {
  memoryCreateSchema,
  memoryUpdateSchema,
  memoryDeleteSchema,
  mcpSearchSchema,
  mcpCreateSchema,
  mcpDeleteSchema,
  importSchema,
} from '@/lib/validation';

describe('validation', () => {
  it('accepts a valid create body', () => {
    const r = memoryCreateSchema.safeParse({
      content: 'Prefers dark mode',
      type: 'preference',
      confidence: 0.9,
      importance: 0.7,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe('preference');
      expect(r.data.confidence).toBe(0.9);
    }
  });

  it('defaults type/confidence/importance', () => {
    const r = memoryCreateSchema.parse({ content: 'x' });
    expect(r.type).toBe('fact');
    expect(r.confidence).toBe(0.8);
    expect(r.importance).toBe(0.6);
  });

  it('rejects empty content and oversized content', () => {
    expect(memoryCreateSchema.safeParse({ content: '' }).success).toBe(false);
    expect(memoryCreateSchema.safeParse({ content: 'a'.repeat(5001) }).success).toBe(false);
  });

  it('rejects invalid type and out-of-range confidence', () => {
    expect(memoryCreateSchema.safeParse({ content: 'x', type: 'nope' }).success).toBe(false);
    expect(memoryCreateSchema.safeParse({ content: 'x', confidence: 1.5 }).success).toBe(false);
  });

  it('update requires at least one field', () => {
    expect(memoryUpdateSchema.safeParse({}).success).toBe(false);
    expect(memoryUpdateSchema.safeParse({ content: 'new' }).success).toBe(true);
  });

  it('delete requires the literal DELETE confirm', () => {
    expect(memoryDeleteSchema.safeParse({ confirm: 'DELETE' }).success).toBe(true);
    expect(memoryDeleteSchema.safeParse({ confirm: 'delete' }).success).toBe(false);
    expect(memoryDeleteSchema.safeParse({}).success).toBe(false);
  });

  it('mcp search requires a non-empty query', () => {
    expect(mcpSearchSchema.safeParse({ query: 'dogs' }).success).toBe(true);
    expect(mcpSearchSchema.safeParse({ query: '' }).success).toBe(false);
  });

  it('mcp create requires content; supersedes must be uuid arrays', () => {
    expect(mcpCreateSchema.safeParse({ content: 'x' }).success).toBe(true);
    expect(mcpCreateSchema.safeParse({}).success).toBe(false);
    expect(
      mcpCreateSchema.safeParse({ content: 'x', supersedes: ['not-a-uuid'] }).success,
    ).toBe(false);
    expect(
      mcpCreateSchema.safeParse({ content: 'x', supersedes: ['123e4567-e89b-12d3-a456-426614174000'] }).success,
    ).toBe(true);
  });

  it('mcp delete enforces confirm literal', () => {
    expect(mcpDeleteSchema.safeParse({ memory_id: '123e4567-e89b-12d3-a456-426614174000', confirm: 'DELETE' }).success).toBe(true);
    expect(mcpDeleteSchema.safeParse({ memory_id: '123e4567-e89b-12d3-a456-426614174000', confirm: 'nope' }).success).toBe(false);
  });

  it('import accepts an array of items and rejects empty', () => {
    expect(importSchema.safeParse({ items: [{ content: 'a' }, { content: 'b', type: 'goal' }] }).success).toBe(true);
    expect(importSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
