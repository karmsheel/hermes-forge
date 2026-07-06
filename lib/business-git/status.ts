import { prisma } from '@/lib/prisma';
import { isGitAvailable } from '@/lib/business-git/exec';
import { resolveBusinessRepoPath } from '@/lib/business-git/paths';
import type { BusinessGitStatus } from '@/lib/business-git/types';

export async function getBusinessGitStatus(
  businessId: string
): Promise<BusinessGitStatus> {
  const gitAvailable = await isGitAvailable();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      gitRepoPath: true,
      gitInitializedAt: true,
      gitHeadCommit: true,
      gitHeadSequence: true,
      gitDirty: true,
      logHeadSequence: true,
      gitRemoteUrl: true,
      gitRemoteBranch: true,
      gitLastPushedAt: true,
      gitLastPushError: true,
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  return {
    gitAvailable,
    initialized: business.gitInitializedAt != null,
    dirty: business.gitDirty,
    repoPath: business.gitRepoPath ?? resolveBusinessRepoPath(businessId),
    headCommit: business.gitHeadCommit,
    headSequence: business.gitHeadSequence,
    logHeadSequence: business.logHeadSequence,
    initializedAt: business.gitInitializedAt?.toISOString() ?? null,
    remoteUrl: business.gitRemoteUrl,
    remoteBranch: business.gitRemoteBranch,
    lastPushedAt: business.gitLastPushedAt?.toISOString() ?? null,
    lastPushError: business.gitLastPushError,
  };
}