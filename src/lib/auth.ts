// Single-user identity. The platform has no account system: every session
// belongs to one fixed owner. Override the id/email via SINGLE_USER_ID /
// SINGLE_USER_EMAIL if your data was originally created under another id.
import { getServerEnv, DEFAULT_SINGLE_USER_ID, DEFAULT_SINGLE_USER_EMAIL } from './env';

export interface SessionUser {
  id: string;
  email: string;
}

/** Returns the single owner identity. Always present — no sign-in needed. */
export async function getSessionUser(): Promise<SessionUser> {
  const env = getServerEnv();
  return {
    id: env.singleUserId || DEFAULT_SINGLE_USER_ID,
    email: env.singleUserEmail || DEFAULT_SINGLE_USER_EMAIL,
  };
}
