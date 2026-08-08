// RFC 8414 Authorization Server metadata.
import { oauthMetadata } from '@/lib/oauth/metadata';
import { json } from '@/lib/oauth/http';

export function GET(): Response {
  return json(oauthMetadata());
}

export function POST(): Response {
  return json(oauthMetadata());
}

export const dynamic = 'force-dynamic';
