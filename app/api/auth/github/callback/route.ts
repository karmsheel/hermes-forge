import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  GITHUB_OAUTH_REDIRECT_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  GithubLinkConflictError,
  attachSessionAndRedirect,
  decodeOAuthState,
  exchangeCodeForToken,
  fetchGithubProfile,
  getGithubOAuthConfig,
  redirectWithError,
  resolveGithubUser,
  sanitizeRedirectPath,
} from '@/lib/github-oauth';

/**
 * GET /api/auth/github/callback
 * Validate OAuth state (signed payload + CSRF nonce cookie), exchange code,
 * upsert/link user, set session, redirect.
 */
export async function GET(request: NextRequest) {
  try {
    const config = getGithubOAuthConfig(request);
    if (!config) {
      return redirectWithError(
        request,
        'GitHub sign-in is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'
      );
    }

    const params = request.nextUrl.searchParams;
    const oauthError = params.get('error');
    if (oauthError) {
      const desc = params.get('error_description') || oauthError;
      return redirectWithError(request, `GitHub authorization failed: ${desc}`);
    }

    const code = params.get('code');
    const stateParam = params.get('state');
    const cookieNonce = request.cookies.get(GITHUB_OAUTH_STATE_COOKIE)?.value;
    const redirectCookie = request.cookies.get(GITHUB_OAUTH_REDIRECT_COOKIE)?.value;

    const decoded = decodeOAuthState(stateParam);
    if (!code || !decoded || !cookieNonce || decoded.nonce !== cookieNonce) {
      return redirectWithError(
        request,
        'GitHub sign-in could not be verified (invalid or expired state). Try again.'
      );
    }

    const accessToken = await exchangeCodeForToken(config, code);
    const profile = await fetchGithubProfile(accessToken);
    const user = await resolveGithubUser(request, profile, {
      linkUserId: decoded.linkUserId,
    });

    const hasOverlord = Boolean(
      (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { forgeOverlordProfileKey: true },
        })
      )?.forgeOverlordProfileKey
    );

    // Prefer signed-state redirect; cookie is a fallback for older in-flight flows.
    const redirectPath = sanitizeRedirectPath(decoded.redirectTo || redirectCookie);
    return attachSessionAndRedirect(request, user, redirectPath, hasOverlord);
  } catch (error) {
    if (error instanceof GithubLinkConflictError) {
      return redirectWithError(request, error.message);
    }
    console.error('GitHub OAuth callback error', error);
    return redirectWithError(
      request,
      error instanceof Error ? error.message : 'GitHub sign-in failed'
    );
  }
}
