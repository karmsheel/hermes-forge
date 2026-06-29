import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

const ProfileSchema = z.object({
  name: z.string().max(100).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = ProfileSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { name: body.name ?? null },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { businesses: true } },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Profile update error', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}