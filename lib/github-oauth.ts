import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  getSessionFromRequest,
  setActiveBusinessCookie,
  setSessionCookie,
} from '@/lib/auth';
import { shouldUseSecureCookies } from '@/lib/auth-secret';
import { isLocalUserEmail, LOCAL_USER_EMAIL } from '@/lib/local-user-email';
import {
  DEFAULT_POST_LOGIN,
  GITHUB_OAUTH_REDIRECT_COOKIE,
  GITHUB_OAUTH_SCOPES,
  GITHUB_OAUTH_STATE_COOKIE,
  STATE_MAX_AGE,
  createOAuthNonce,
  createOAuthState,
  decodeOAuthState,
  encodeOAuthState,
  isRichLocalPlaceholder,
  sanitizeRedirectPath,
  type OAuthStatePayload,
} from '@/lib/github-oauth-state';

export {
  DEFAULT_POST_LOGIN,
  GITHUB_OAUTH_REDIRECT_COOKIE,
  GITHUB_OAUTH_SCOPES,
  GITHUB_OAUTH_STATE_COOKIE,
  STATE_MAX_AGE,
  createOAuthNonce,
  createOAuthState,
  decodeOAuthState,
  encodeOAuthState,
  isRichLocalPlaceholder,
  sanitizeRedirectPath,
};
export type { OAuthStatePayload };

export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** Absolute callback URL, e.g. http://127.0.0.1:3847/api/auth/github/callback */
  redirectUri: string;
};

export function getGithubOAuthConfig(request: NextRequest): GithubOAuthConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const override = process.env.GITHUB_REDIRECT_URI?.trim();
  // Prefer request origin so desktop (127.0.0.1:3847) and web (localhost:3000)
  // both emit a callback that matches the host the browser already uses.
  // Do not hardcode localhost — cookies are host-scoped; 127.0.0.1 ≠ localhost.
  const redirectUri =
    override ||
    new URL('/api/auth/github/callback', request.nextUrl.origin).toString();

  return { clientId, clientSecret, redirectUri };
}

export function isGithubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}

export function setOAuthCookies(
  response: NextResponse,
  nonce: string,
  redirectTo: string
) {
  const secure = shouldUseSecureCookies();
  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_MAX_AGE,
  });
  response.cookies.set(GITHUB_OAUTH_REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_MAX_AGE,
  });
}

export function clearOAuthCookies(response: NextResponse) {
  const secure = shouldUseSecureCookies();
  for (const name of [GITHUB_OAUTH_STATE_COOKIE, GITHUB_OAUTH_REDIRECT_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

export function buildGithubAuthorizeUrl(config: GithubOAuthConfig, state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPES);
  url.searchParams.set('state', state);
  return url.toString();
}

export type GithubProfile = {
  id: string;
  login: string;
  name: string | null;
  /** Always set (primary verified email or github-noreply fallback). */
  email: string;
  avatarUrl: string | null;
};

type GithubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
};

type GithubApiUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url?: string | null;
};

type GithubEmailEntry = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

export async function exchangeCodeForToken(
  config: GithubOAuthConfig,
  code: string
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status})`);
  }

  const data = (await res.json()) as GithubTokenResponse;
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub token exchange failed');
  }
  return data.access_token;
}

export async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Hermes-Forge',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!userRes.ok) {
    throw new Error(`GitHub user fetch failed (${userRes.status})`);
  }

  const user = (await userRes.json()) as GithubApiUser;
  let email = user.email?.trim().toLowerCase() || null;

  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Hermes-Forge',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as GithubEmailEntry[];
      const verified = emails.filter((e) => e.verified && e.email);
      const primary = verified.find((e) => e.primary);
      email = (primary ?? verified[0])?.email?.trim().toLowerCase() ?? null;
    }
  }

  if (!email) {
    // Fallback synthetic email so User.email uniqueness still works.
    email = `github-${user.id}@users.noreply.github.com`;
  }

  return {
    id: String(user.id),
    login: user.login,
    name: user.name?.trim() || user.login,
    email,
    avatarUrl: user.avatar_url ?? null,
  };
}

export class GithubLinkConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubLinkConflictError';
  }
}

type UserWithBusiness = {
  id: string;
  email: string;
  name: string | null;
  githubId: string | null;
  githubLogin: string | null;
  forgeOverlordProfileKey: string | null;
  businesses: { id: string }[];
  _count?: { businesses: number };
};

const userInclude = {
  businesses: { orderBy: { updatedAt: 'desc' as const }, take: 1 },
};

/** Empty shell: no businesses and no overlord — safe to absorb when re-homing githubId. */
export function isEmptyGithubShell(user: {
  forgeOverlordProfileKey?: string | null;
  businesses: { id: string }[];
  _count?: { businesses: number };
}): boolean {
  const count =
    user._count?.businesses ??
    user.businesses?.length ??
    0;
  return count === 0 && !user.forgeOverlordProfileKey?.trim();
}

/**
 * Link GitHub identity onto an existing Forge user row (upgrade path).
 * Does not merge two distinct rich accounts.
 *
 * If `githubId` is already on an empty shell user (no businesses/overlord),
 * that shell is deleted so the identity can move onto `current` (desktop
 * split-user recovery).
 */
async function linkGithubToUser(
  current: UserWithBusiness,
  profile: GithubProfile,
  options?: { emptyShellToAbsorb?: UserWithBusiness | null }
): Promise<UserWithBusiness> {
  const githubId = profile.id;
  const githubLogin = profile.login;
  const email = profile.email.toLowerCase().trim();
  const shell = options?.emptyShellToAbsorb;

  // Update email from GitHub when safe: local placeholder, or same email, or free.
  let nextEmail = current.email;
  if (isLocalUserEmail(current.email)) {
    const emailTaken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    // Email owned by the empty shell we are about to delete is also free.
    if (
      !emailTaken ||
      emailTaken.id === current.id ||
      (shell && emailTaken.id === shell.id)
    ) {
      nextEmail = email;
    }
  } else if (current.email.toLowerCase() !== email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!emailTaken || (shell && emailTaken.id === shell.id)) {
      nextEmail = email;
    }
    // If email is taken by another user, keep current email (still link github).
  }

  if (shell && shell.id !== current.id) {
    return prisma.$transaction(async (tx) => {
      // Free unique constraints on the empty shell, then upgrade current, delete shell.
      await tx.user.update({
        where: { id: shell.id },
        data: {
          githubId: null,
          githubLogin: null,
          email: `recovered-deleted-${shell.id}@hermes-forge.invalid`,
        },
      });
      const updated = await tx.user.update({
        where: { id: current.id },
        data: {
          githubId,
          githubLogin,
          email: nextEmail,
          name: current.name || profile.name,
        },
        include: userInclude,
      });
      await tx.user.delete({ where: { id: shell.id } });
      return updated;
    });
  }

  return prisma.user.update({
    where: { id: current.id },
    data: {
      githubId,
      githubLogin,
      email: nextEmail,
      name: current.name || profile.name,
    },
    include: userInclude,
  });
}

/**
 * When session/linkUserId is missing, find at most one rich local placeholder
 * that is safe to upgrade. Never merges two rich accounts; never claims a
 * local user that already has a different githubId.
 */
export async function findSoleRichLocalPlaceholder(): Promise<UserWithBusiness | null> {
  const locals = await prisma.user.findMany({
    where: {
      email: LOCAL_USER_EMAIL,
      githubId: null,
    },
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
      _count: { select: { businesses: true } },
    },
  });

  const rich = locals.filter((u) =>
    isRichLocalPlaceholder({
      email: u.email,
      githubId: u.githubId,
      forgeOverlordProfileKey: u.forgeOverlordProfileKey,
      businessCount: u._count.businesses,
    })
  );

  if (rich.length !== 1) return null;
  return rich[0]!;
}

/**
 * Upsert or link a GitHub identity.
 * Priority:
 * 1. Session cookie user (or signed OAuth `linkUserId`) → upgrade that row
 * 2. Existing githubId
 * 3. Verified email match
 * 4. Sole rich local placeholder (desktop session-loss recovery)
 * 5. Create new user
 *
 * Never silently merges two rich accounts. Throws GithubLinkConflictError when
 * GitHub is already linked to a different user.
 */
export async function resolveGithubUser(
  request: NextRequest,
  profile: GithubProfile,
  options?: { linkUserId?: string | null }
) {
  const session = await getSessionFromRequest(request);
  const githubId = profile.id;
  const githubLogin = profile.login;
  const email = profile.email.toLowerCase().trim();

  // Prefer live session; fall back to linkUserId captured at authorize time.
  const upgradeUserId = session?.userId || options?.linkUserId || null;

  const existingByGithub = await prisma.user.findUnique({
    where: { githubId },
    include: userInclude,
  });

  if (upgradeUserId) {
    // Upgrade / link path — keep the same user row and businesses.
    if (existingByGithub && existingByGithub.id !== upgradeUserId) {
      // Allow re-homing only when the other row is an empty shell (prior bug).
      if (!isEmptyGithubShell(existingByGithub)) {
        throw new GithubLinkConflictError(
          'This GitHub account is already linked to a different Hermes Forge user. Sign in with that account, or use a different GitHub identity.'
        );
      }
    }

    const current = await prisma.user.findUnique({
      where: { id: upgradeUserId },
      include: userInclude,
    });
    if (!current) {
      // Stale linkUserId / deleted user — fall through to logged-out paths.
    } else {
      const shell =
        existingByGithub &&
        existingByGithub.id !== current.id &&
        isEmptyGithubShell(existingByGithub)
          ? existingByGithub
          : null;
      return linkGithubToUser(current, profile, { emptyShellToAbsorb: shell });
    }
  }

  // Logged-out: existing GitHub user
  if (existingByGithub) {
    // If this githubId sits on an empty shell and a sole rich local exists,
    // re-home onto local (recovery for earlier session-loss creates).
    if (isEmptyGithubShell(existingByGithub)) {
      const soleLocal = await findSoleRichLocalPlaceholder();
      if (soleLocal && soleLocal.id !== existingByGithub.id) {
        return linkGithubToUser(soleLocal, profile, {
          emptyShellToAbsorb: existingByGithub,
        });
      }
    }
    return prisma.user.update({
      where: { id: existingByGithub.id },
      data: {
        githubLogin,
        // Refresh name if empty
        name: existingByGithub.name || profile.name,
      },
      include: userInclude,
    });
  }

  // Match by email (verified GitHub email)
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    include: userInclude,
  });

  if (existingByEmail) {
    if (existingByEmail.githubId && existingByEmail.githubId !== githubId) {
      throw new GithubLinkConflictError(
        'An account with this email already exists and is linked to a different GitHub identity.'
      );
    }
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        githubId,
        githubLogin,
        name: existingByEmail.name || profile.name,
      },
      include: userInclude,
    });
  }

  // Desktop recovery: sole rich local@hermes-forge.local with businesses/overlord
  // and no githubId — upgrade instead of creating an empty second user.
  const soleLocal = await findSoleRichLocalPlaceholder();
  if (soleLocal) {
    return linkGithubToUser(soleLocal, profile);
  }

  // Brand-new OAuth user
  return prisma.user.create({
    data: {
      email,
      name: profile.name,
      passwordHash: null,
      githubId,
      githubLogin,
    },
    include: userInclude,
  });
}

/** Prefer request origin so desktop (3847) and web (3000) both work. */
export async function attachSessionAndRedirect(
  request: NextRequest,
  user: {
    id: string;
    email: string;
    name: string | null;
    businesses: { id: string }[];
  },
  redirectPath: string,
  hasOverlord: boolean
): Promise<NextResponse> {
  const token = await createSessionToken({ userId: user.id, email: user.email });
  const destination = hasOverlord ? redirectPath : '/setup/overlord';
  const response = NextResponse.redirect(new URL(destination, request.url));
  setSessionCookie(response, token);
  if (user.businesses[0]) {
    setActiveBusinessCookie(response, user.businesses[0].id);
  }
  clearOAuthCookies(response);
  return response;
}

export function redirectWithError(request: NextRequest, message: string): NextResponse {
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('error', message);
  const response = NextResponse.redirect(url);
  clearOAuthCookies(response);
  return response;
}
