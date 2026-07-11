import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  hashPassword,
  setActiveBusinessCookie,
  setSessionCookie,
} from '@/lib/auth';
import { NextResponse } from 'next/server';
import { LOCAL_USER_EMAIL } from '@/lib/local-user-email';

export { LOCAL_USER_EMAIL, isLocalUserEmail } from '@/lib/local-user-email';

export async function ensureLocalUser() {
  const existing = await prisma.user.findUnique({
    where: { email: LOCAL_USER_EMAIL },
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  });

  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: LOCAL_USER_EMAIL,
      name: 'Local',
      passwordHash: await hashPassword(crypto.randomUUID()),
    },
    include: {
      businesses: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  });
}

export async function createLocalSessionResponse() {
  const user = await ensureLocalUser();
  const token = await createSessionToken({ userId: user.id, email: user.email });
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
  setSessionCookie(response, token);

  const business = user.businesses[0];
  if (business) {
    setActiveBusinessCookie(response, business.id);
  }

  return response;
}
