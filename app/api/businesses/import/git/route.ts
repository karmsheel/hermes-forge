import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { importBusinessFromGitRepo } from '@/lib/business-git';

const ImportGitSchema = z
  .object({
    repoPath: z.string().min(1).max(1000).optional(),
    remoteUrl: z.string().url().optional(),
    branch: z.string().min(1).max(100).optional(),
  })
  .refine((v) => Boolean(v.repoPath?.trim() || v.remoteUrl?.trim()), {
    message: 'Provide repoPath or remoteUrl',
  });

/**
 * Restore a business from a Hermes Forge Git snapshot.
 * - `repoPath`: absolute path to a local materialized business repo
 * - `remoteUrl`: clone then import (uses system Git credentials)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = ImportGitSchema.parse(await request.json());

    const result = await importBusinessFromGitRepo({
      userId: session.userId,
      repoPath: body.repoPath,
      remoteUrl: body.remoteUrl,
      branch: body.branch,
    });

    return NextResponse.json({
      business: {
        id: result.businessId,
        name: result.businessName,
      },
      counts: result.counts,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid import request' },
        { status: 400 }
      );
    }
    console.error('Git business import error', error);
    const message =
      error instanceof Error ? error.message : 'Failed to import business from Git';
    const status =
      message.includes('Git is not installed') || message.includes('not available')
        ? 503
        : message.includes('Not a Hermes Forge') ||
            message.includes('does not exist') ||
            message.includes('Provide a local')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
