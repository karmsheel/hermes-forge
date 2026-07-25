import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { getAuthSecretString } from '@/lib/auth-secret';
import { isLocalUserEmail } from '@/lib/local-user-email';

export const GITHUB_OAUTH_STATE_COOKIE = 'forge_github_oauth_state';
export const GITHUB_OAUTH_REDIRECT_COOKIE = 'forge_github_oauth_redirect';
export const GITHUB_OAUTH_SCOPES = 'read:user user:email';

export const STATE_MAX_AGE = 60 * 10; // 10 minutes
export const DEFAULT_POST_LOGIN = '/business-manager';

/** Signed OAuth state payload (carried in the GitHub `state` query param). */
export type OAuthStatePayload = {
  /** CSRF nonce; must match the httpOnly cookie. */
  nonce: string;
  /** Post-login relative path. */
  redirectTo: string;
  /**
   * User id to upgrade/link when the authorize step had a session.
   * Survives session-cookie loss on the GitHub round-trip (desktop HTTP).
   */
  linkUserId?: string;
  /** Unix seconds expiry. */
  exp: number;
};

export function createOAuthNonce(): string {
  return randomBytes(24).toString('hex');
}

/** @deprecated use createOAuthNonce + encodeOAuthState */
export function createOAuthState(): string {
  return createOAuthNonce();
}

export function sanitizeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_POST_LOGIN;
  const value = raw.trim();
  // Only allow same-origin relative paths (no protocol-relative //evil.com).
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_POST_LOGIN;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) {
    return DEFAULT_POST_LOGIN;
  }
  return value;
}

function signStateBody(body: string): string {
  return createHmac('sha256', getAuthSecretString()).update(body).digest('base64url');
}

/**
 * Encode a signed OAuth state value for GitHub's `state` parameter.
 * Carries redirect + optional linkUserId so local→GitHub upgrade survives
 * session cookie loss; CSRF is enforced via the nonce cookie.
 */
export function encodeOAuthState(input: {
  nonce: string;
  redirectTo: string;
  linkUserId?: string | null;
  maxAgeSec?: number;
}): string {
  const payload: OAuthStatePayload = {
    nonce: input.nonce,
    redirectTo: sanitizeRedirectPath(input.redirectTo),
    exp: Math.floor(Date.now() / 1000) + (input.maxAgeSec ?? STATE_MAX_AGE),
  };
  if (input.linkUserId) {
    payload.linkUserId = input.linkUserId;
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signStateBody(body)}`;
}

export function decodeOAuthState(state: string | null | undefined): OAuthStatePayload | null {
  if (!state) return null;
  const dot = state.indexOf('.');
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = signStateBody(body);
  } catch {
    return null;
  }

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as OAuthStatePayload;
    if (!payload?.nonce || typeof payload.nonce !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      nonce: payload.nonce,
      redirectTo: sanitizeRedirectPath(payload.redirectTo),
      linkUserId:
        typeof payload.linkUserId === 'string' && payload.linkUserId
          ? payload.linkUserId
          : undefined,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Pure predicate: is this a local placeholder that is safe to upgrade when it is
 * the sole such rich account (has businesses and/or overlord, no githubId).
 */
export function isRichLocalPlaceholder(user: {
  email: string;
  githubId: string | null;
  forgeOverlordProfileKey?: string | null;
  businessCount: number;
}): boolean {
  if (!isLocalUserEmail(user.email)) return false;
  if (user.githubId) return false;
  const hasOverlord = Boolean(user.forgeOverlordProfileKey?.trim());
  return user.businessCount > 0 || hasOverlord;
}
