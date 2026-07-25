import { NextResponse } from 'next/server';

import { isGithubOAuthConfigured } from '@/lib/github-oauth';

/**
 * GET /api/auth/github/status
 * Public probe so the sign-in UI can show configured vs missing env (no secrets).
 */
export async function GET() {
  return NextResponse.json({ configured: isGithubOAuthConfigured() });
}
