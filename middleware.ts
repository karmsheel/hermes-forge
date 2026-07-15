import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-session';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/sign-in'];
// `/login` and `/signup` redirect to `/` — kept public so old links don't loop.
// `/sign-in` is the post-Hermes identity choice (local / email / GitHub).
const AUTH_API_PREFIX = '/api/auth';
// Hermes connection probes run before the user signs in (local BYOK gateway).
const HERMES_API_PREFIX = '/api/hermes';
// Token-authenticated agent → Content handoff (Automation.ingestToken).
const CONTENT_INGEST_PATH = '/api/content/ingest';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|svg)$/)
  ) {
    return NextResponse.next();
  }

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith(AUTH_API_PREFIX) ||
    pathname.startsWith(HERMES_API_PREFIX) ||
    pathname === CONTENT_INGEST_PATH
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const welcomeUrl = new URL('/', request.url);
    welcomeUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(welcomeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};