/**
 * Shared AUTH_SECRET accessors without Next.js imports (safe for unit tests).
 */

export function getAuthSecretString(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }
  return secret;
}

/**
 * Whether Set-Cookie should include `Secure`.
 * Desktop Electron always serves HTTP on 127.0.0.1 — Secure cookies would be
 * dropped by Chromium and break session + OAuth round-trips after NODE_ENV=production.
 * Web production on HTTPS keeps Secure.
 */
export function shouldUseSecureCookies(): boolean {
  if (process.env.FORGE_DESKTOP === '1' || process.env.FORGE_DESKTOP === 'true') {
    return false;
  }
  if (process.env.COOKIE_SECURE === '0' || process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  if (process.env.COOKIE_SECURE === '1' || process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}
