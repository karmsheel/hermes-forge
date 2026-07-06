import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireBusinessAccess } from '@/lib/auth';
import { getBusinessGitStatus, syncBusinessGitRepo } from '@/lib/business-git';

type RouteContext = { params: Promise<{ id: string }> };

const PatchGitSchema = z.object({
  remoteUrl: z.string().url().nullable().optional(),
  remoteBranch: z.string().min(1).max(100).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const status = await getBusinessGitStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Business git status error', error);
    return NextResponse.json({ error: 'Failed to load Git status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });

    const result = await syncBusinessGitRepo(id, {
      userEmail: user?.email,
      userName: user?.name,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Business git sync error', error);
    const message =
      error instanceof Error ? error.message : 'Failed to sync business to Git';
    const status = message.includes('Git is not installed') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireBusinessAccess(request, id);
    if (session instanceof NextResponse) return session;

    const body = PatchGitSchema.parse(await request.json());

    const business = await prisma.business.update({
      where: { id },
      data: {
        ...(body.remoteUrl !== undefined ? { gitRemoteUrl: body.remoteUrl } : {}),
        ...(body.remoteBranch !== undefined
          ? { gitRemoteBranch: body.remoteBranch }
          : {}),
      },
      select: {
        gitRemoteUrl: true,
        gitRemoteBranch: true,
      },
    });

    return NextResponse.json({
      remoteUrl: business.gitRemoteUrl,
      remoteBranch: business.gitRemoteBranch,
      note: 'Remote saved. GitHub push is not implemented yet.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Business git patch error', error);
    return NextResponse.json({ error: 'Failed to update Git remote' }, { status: 500 });
  }
}