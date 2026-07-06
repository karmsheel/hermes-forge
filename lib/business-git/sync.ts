import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  git,
  gitHasCommits,
  gitStatusPorcelain,
  isGitAvailable,
} from '@/lib/business-git/exec';
import { materializeBusinessRepo } from '@/lib/business-git/materialize';
import { resolveBusinessRepoPath } from '@/lib/business-git/paths';
import type { BusinessGitSyncResult } from '@/lib/business-git/types';

export interface SyncBusinessGitOptions {
  userEmail?: string | null;
  userName?: string | null;
}

async function ensureGitIdentity(
  repoPath: string,
  options: SyncBusinessGitOptions
): Promise<void> {
  const email = options.userEmail?.trim() || 'forge@hermes.local';
  const name = options.userName?.trim() || 'Hermes Forge';
  await git(repoPath, ['config', 'user.email', email]);
  await git(repoPath, ['config', 'user.name', name]);
}

function buildCommitMessage(
  prevSequence: number | null,
  nextSequence: number,
  isGenesis: boolean
): string {
  if (isGenesis || prevSequence == null || prevSequence === 0) {
    return `forge: genesis seq=1..${nextSequence}`;
  }
  const from = prevSequence + 1;
  if (from > nextSequence) {
    return `forge: snapshot seq=${nextSequence}`;
  }
  return `forge: sync seq=${from}..${nextSequence}`;
}

export async function syncBusinessGitRepo(
  businessId: string,
  options: SyncBusinessGitOptions = {}
): Promise<BusinessGitSyncResult> {
  if (!(await isGitAvailable())) {
    throw new Error('Git is not installed or not available on PATH');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      logHeadSequence: true,
      gitInitializedAt: true,
      gitHeadSequence: true,
      gitHeadCommit: true,
      gitRepoPath: true,
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const repoPath = business.gitRepoPath ?? resolveBusinessRepoPath(businessId);
  await fs.mkdir(repoPath, { recursive: true });

  const isNewRepo = business.gitInitializedAt == null;
  if (isNewRepo) {
    await git(repoPath, ['init']);
    await ensureGitIdentity(repoPath, options);
  } else {
    await ensureGitIdentity(repoPath, options);
  }

  const hadCommits = await gitHasCommits(repoPath);
  const prevGitSequence = business.gitHeadSequence;

  const { manifest } = await materializeBusinessRepo(
    repoPath,
    businessId,
    business.gitHeadCommit
  );

  await git(repoPath, ['add', '-A']);

  const porcelain = await gitStatusPorcelain(repoPath);
  const hasChanges = porcelain.length > 0;

  let headCommit = business.gitHeadCommit;
  let committed = false;
  let message: string;

  if (hasChanges || !hadCommits) {
    const commitMsg = buildCommitMessage(
      prevGitSequence,
      business.logHeadSequence,
      isNewRepo || !hadCommits
    );
    const commitArgs = ['commit', '-m', commitMsg];
    if (!hasChanges) commitArgs.push('--allow-empty');
    await git(repoPath, commitArgs);
    const { stdout } = await git(repoPath, ['rev-parse', 'HEAD']);
    headCommit = stdout;
    committed = true;
    message = commitMsg;
  } else {
    message = 'No file changes since last sync';
  }

  const syncedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        gitRepoPath: repoPath,
        gitInitializedAt: business.gitInitializedAt ?? syncedAt,
        gitHeadCommit: headCommit,
        gitHeadSequence: business.logHeadSequence,
        gitDirty: false,
      },
    });

    if (committed && headCommit) {
      const fromSeq = prevGitSequence != null ? prevGitSequence + 1 : 1;
      await tx.businessEvent.updateMany({
        where: {
          businessId,
          sequence: { gte: fromSeq, lte: business.logHeadSequence },
          gitCommitSha: null,
        },
        data: { gitCommitSha: headCommit },
      });
    }
  });

  if (headCommit) {
    const manifestPath = path.join(repoPath, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as { gitHeadCommit?: string | null };
      parsed.gitHeadCommit = headCommit;
      await fs.writeFile(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    } catch {
      // Non-fatal; next sync will rewrite manifest
    }
  }

  return {
    ok: true,
    committed,
    headCommit,
    headSequence: business.logHeadSequence,
    logHeadSequence: manifest.logHeadSequence,
    message,
    repoPath,
  };
}