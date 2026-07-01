import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  BUSINESS_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  setActiveBusinessCookie,
  setSessionCookie,
  clearSessionCookie,
  verifySessionToken,
  type SessionPayload,
} from '@/lib/auth-session';

export type { SessionPayload };
export {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  setActiveBusinessCookie,
  SESSION_COOKIE,
  BUSINESS_COOKIE,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { businesses: true } },
    },
  });
}

export async function getActiveBusinessId(request?: NextRequest): Promise<string | null> {
  if (request) {
    return request.cookies.get(BUSINESS_COOKIE)?.value ?? null;
  }
  const cookieStore = await cookies();
  return cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
}

export async function requireSession(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

export async function requireBusinessAccess(
  request: NextRequest,
  businessId: string
): Promise<SessionPayload | NextResponse> {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.userId },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  return session;
}

export async function getActiveBusinessForUser(userId: string, request?: NextRequest) {
  const businessId = await getActiveBusinessId(request);

  if (businessId) {
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId },
    });
    if (business) return business;
  }

  return prisma.business.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function requireProcessAccess(request: NextRequest, processId: string) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return { error: session };

  const activeBusiness = await getActiveBusinessForUser(session.userId, request);
  if (!activeBusiness) {
    return { error: NextResponse.json({ error: 'No active business' }, { status: 400 }) };
  }

  const process = await prisma.process.findFirst({
    where: {
      id: processId,
      businessId: activeBusiness.id,
      business: { userId: session.userId },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      business: { select: { id: true, name: true, userId: true } },
    },
  });

  if (!process) {
    return { error: NextResponse.json({ error: 'Process not found' }, { status: 404 }) };
  }

  return { session, process };
}