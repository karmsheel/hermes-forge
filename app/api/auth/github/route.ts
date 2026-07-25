import { NextRequest, NextResponse } from 'next/server';

import { getSessionFromRequest } from '@/lib/auth';
import {
  buildGithubAuthorizeUrl,
  createOAuthNonce,
  encodeOAuthState,
  getGithubOAuthConfig,
  sanitizeRedirectPath,
  setOAuthCookies,
} from '@/lib/github-oauth';

/**
 * GET /api/auth/github
 * Start GitHub OAuth authorization-code flow (identity only: read:user, user:email).
 *
 * Query:
 *   - redirect: post-login path (default /business-manager)
 *
 * When a session is present, its userId is sealed into the signed OAuth `state`
 * so Local → GitHub still upgrades the same row if the session cookie is lost
 * on the GitHub round-trip (common on desktop HTTP).
 */
export async function GET(request: NextRequest) {
  const config = getGithubOAuthConfig(request);
  if (!config) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set(
      'error',
      'GitHub sign-in is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'
    );
    return NextResponse.redirect(url);
  }

  const redirectTo = sanitizeRedirectPath(
    request.nextUrl.searchParams.get('redirect')
  );
  const session = await getSessionFromRequest(request);
  const nonce = createOAuthNonce();
  const state = encodeOAuthState({
    nonce,
    redirectTo,
    linkUserId: session?.userId ?? null,
  });
  const authorizeUrl = buildGithubAuthorizeUrl(config, state);

  const response = NextResponse.redirect(authorizeUrl);
  // Cookie holds CSRF nonce only; full payload (incl. linkUserId) is in `state`.
  setOAuthCookies(response, nonce, redirectTo);
  return response;
}
