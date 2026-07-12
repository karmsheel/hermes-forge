import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireBusinessAccess } from '@/lib/auth';
import {
  getBusinessGitStatus,
  pushBusinessGitRepo,
  syncBusinessGitRepo,
} from '@/lib/business-git';

type RouteContext = { params: Promise<{ id: string }> };

const PatchGitSchema = z.object({
  remoteUrl: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v)),
  remoteBranch: z.string().min(1).max(100).optional(),
});

const PostGitSchema = z
  .object({
    action: z.enum(['sync', 'push', 'sync_and_push']).optional().default('sync'),
  })
  .optional()
  .default({ action: 'sync' });

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

    let body: z.infer<typeof PostGitSchema> = { action: 'sync' };
    try {
      const raw = await request.json();
      body = PostGitSchema.parse(raw ?? {});
    } catch {
      // Empty body → default sync (back-compat with existing Profile "Git" button)
      body = { action: 'sync' };
    }

    const action = body.action ?? 'sync';

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });

    if (action === 'sync' || action === 'sync_and_push') {
      const syncResult = await syncBusinessGitRepo(id, {
        userEmail: user?.email,
        userName: user?.name,
      });

      if (action === 'sync') {
        return NextResponse.json(syncResult);
      }

      const pushResult = await pushBusinessGitRepo(id);
      return NextResponse.json({
        ...syncResult,
        push: pushResult,
        message: `${syncResult.message}; ${pushResult.message}`,
      });
    }

    // push only
    const pushResult = await pushBusinessGitRepo(id);
    return NextResponse.json(pushResult);
  } catch (error) {
    console.error('Business git action error', error);
    const message =
      error instanceof Error ? error.message : 'Failed to run Git action';
    const status = message.includes('Git is not installed')
      ? 503
      : message.includes('No Git remote') || message.includes('not initialized')
        ? 400
        : 500;
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
      note: business.gitRemoteUrl
        ? 'Remote saved. Use Sync then Push (or Sync & push) to publish.'
        : 'Remote cleared.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Business git patch error', error);
    return NextResponse.json({ error: 'Failed to update Git remote' }, { status: 500 });
  }
}
