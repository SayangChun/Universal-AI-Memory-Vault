// RFC 9728 Protected Resource metadata.
import { protectedResourceMetadata } from '@/lib/oauth/metadata';
import { json } from '@/lib/oauth/http';

export function GET(): Response {
  return json(protectedResourceMetadata());
}

export function POST(): Response {
  return json(protectedResourceMetadata());
}

export const dynamic = 'force-dynamic';
