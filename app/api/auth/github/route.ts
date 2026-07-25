import { NextRequest, NextResponse } from 'next/server';

import {
  buildGithubAuthorizeUrl,
  createOAuthState,
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
  const state = createOAuthState();
  const authorizeUrl = buildGithubAuthorizeUrl(config, state);

  const response = NextResponse.redirect(authorizeUrl);
  setOAuthCookies(response, state, redirectTo);
  return response;
}
