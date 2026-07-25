import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  getSessionFromRequest,
  setActiveBusinessCookie,
  setSessionCookie,
} from '@/lib/auth';
import { isLocalUserEmail } from '@/lib/local-user-email';

export const GITHUB_OAUTH_STATE_COOKIE = 'forge_github_oauth_state';
export const GITHUB_OAUTH_REDIRECT_COOKIE = 'forge_github_oauth_redirect';
export const GITHUB_OAUTH_SCOPES = 'read:user user:email';

const STATE_MAX_AGE = 60 * 10; // 10 minutes
const DEFAULT_POST_LOGIN = '/business-manager';

export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** Absolute callback URL, e.g. http://localhost:3000/api/auth/github/callback */
  redirectUri: string;
};

export function getGithubOAuthConfig(request: NextRequest): GithubOAuthConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const override = process.env.GITHUB_REDIRECT_URI?.trim();
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

export function createOAuthState(): string {
  return randomBytes(24).toString('hex');
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

export function setOAuthCookies(
  response: NextResponse,
  state: string,
  redirectTo: string
) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, state, {
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
  const secure = process.env.NODE_ENV === 'production';
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

/**
 * Upsert or link a GitHub identity.
 * - Logged-in session → attach githubId to that user (upgrade local / email).
 * - Logged-out → find by githubId, else verified email, else create.
 */
export async function resolveGithubUser(
  request: NextRequest,
  profile: GithubProfile
) {
  const session = await getSessionFromRequest(request);
  const githubId = profile.id;
  const githubLogin = profile.login;
  const email = profile.email.toLowerCase().trim();

  const existingByGithub = await prisma.user.findUnique({
    where: { githubId },
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  });

  if (session) {
    // Upgrade / link path — keep the same user row and businesses.
    if (existingByGithub && existingByGithub.id !== session.userId) {
      throw new GithubLinkConflictError(
        'This GitHub account is already linked to a different Hermes Forge user. Sign in with that account, or use a different GitHub identity.'
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
    if (!current) {
      throw new Error('Session user not found');
    }

    // Update email from GitHub when safe: local placeholder, or same email, or free.
    let nextEmail = current.email;
    if (isLocalUserEmail(current.email)) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!emailTaken || emailTaken.id === current.id) {
        nextEmail = email;
      }
    } else if (current.email.toLowerCase() !== email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!emailTaken) {
        nextEmail = email;
      }
      // If email is taken by another user, keep current email (still link github).
    }

    return prisma.user.update({
      where: { id: current.id },
      data: {
        githubId,
        githubLogin,
        email: nextEmail,
        name: current.name || profile.name,
      },
      include: {
        businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
  }

  // Logged-out: existing GitHub user
  if (existingByGithub) {
    return prisma.user.update({
      where: { id: existingByGithub.id },
      data: {
        githubLogin,
        // Refresh name if empty
        name: existingByGithub.name || profile.name,
      },
      include: {
        businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
  }

  // Match by email (verified GitHub email)
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
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
      include: {
        businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
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
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
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
