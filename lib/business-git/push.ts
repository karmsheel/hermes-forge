import { prisma } from '@/lib/prisma';
import { git, isGitAvailable } from '@/lib/business-git/exec';
import { resolveBusinessRepoPath } from '@/lib/business-git/paths';
import type { BusinessGitPushResult } from '@/lib/business-git/types';

function formatGitError(error: unknown): string {
  if (!(error instanceof Error)) return 'Git push failed';
  const anyErr = error as Error & { stderr?: string; stdout?: string };
  const stderr = typeof anyErr.stderr === 'string' ? anyErr.stderr.trim() : '';
  const stdout = typeof anyErr.stdout === 'string' ? anyErr.stdout.trim() : '';
  const detail = stderr || stdout || anyErr.message;
  if (/could not read Username|Authentication failed|Permission denied|403|401/i.test(detail)) {
    return (
      'Authentication failed. Sign in to Git via Credential Manager, SSH agent, or a credential helper, then try again.'
    );
  }
  if (/Could not resolve host|unable to access|Failed to connect|timed out/i.test(detail)) {
    return `Network error while pushing: ${detail.slice(0, 400)}`;
  }
  return detail.slice(0, 500) || 'Git push failed';
}

async function ensureOriginRemote(repoPath: string, remoteUrl: string): Promise<void> {
  try {
    const { stdout } = await git(repoPath, ['remote']);
    const remotes = stdout.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    if (remotes.includes('origin')) {
      await git(repoPath, ['remote', 'set-url', 'origin', remoteUrl]);
    } else {
      await git(repoPath, ['remote', 'add', 'origin', remoteUrl]);
    }
  } catch {
    await git(repoPath, ['remote', 'add', 'origin', remoteUrl]);
  }
}

/**
 * Push the local business Git mirror to the configured remote.
 * Does not materialize or commit — call sync first when the DB is dirty.
 */
export async function pushBusinessGitRepo(businessId: string): Promise<BusinessGitPushResult> {
  if (!(await isGitAvailable())) {
    throw new Error('Git is not installed or not available on PATH');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      gitRepoPath: true,
      gitInitializedAt: true,
      gitHeadCommit: true,
      gitRemoteUrl: true,
      gitRemoteBranch: true,
      gitDirty: true,
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const remoteUrl = business.gitRemoteUrl?.trim();
  if (!remoteUrl) {
    throw new Error('No Git remote configured. Save a remote URL first.');
  }

  if (!business.gitInitializedAt) {
    throw new Error('Local Git repo is not initialized. Sync to Git first.');
  }

  const repoPath = business.gitRepoPath ?? resolveBusinessRepoPath(businessId);
  const branch = business.gitRemoteBranch?.trim() || 'main';

  try {
    await ensureOriginRemote(repoPath, remoteUrl);

    // Prefer pushing the current branch; fall back to explicit branch name.
    let currentBranch = branch;
    try {
      const { stdout } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
      if (stdout && stdout !== 'HEAD') currentBranch = stdout;
    } catch {
      // keep configured branch
    }

    // Align local default branch name with remote preference when still on master.
    if (currentBranch === 'master' && branch === 'main') {
      try {
        await git(repoPath, ['branch', '-M', 'main']);
        currentBranch = 'main';
      } catch {
        // non-fatal
      }
    }

    await git(
      repoPath,
      ['push', '-u', 'origin', `HEAD:refs/heads/${branch}`],
      { noPrompt: true, timeoutMs: 120_000 }
    );

    const { stdout: headCommit } = await git(repoPath, ['rev-parse', 'HEAD']);
    const pushedAt = new Date();

    await prisma.business.update({
      where: { id: businessId },
      data: {
        gitLastPushedAt: pushedAt,
        gitLastPushError: null,
        gitHeadCommit: headCommit || business.gitHeadCommit,
      },
    });

    return {
      ok: true,
      pushed: true,
      headCommit: headCommit || business.gitHeadCommit,
      remoteUrl,
      remoteBranch: branch,
      message: business.gitDirty
        ? `Pushed to origin/${branch} (local DB still has unsynced changes — run Sync first next time)`
        : `Pushed to origin/${branch}`,
      lastPushedAt: pushedAt.toISOString(),
    };
  } catch (error) {
    const message = formatGitError(error);
    await prisma.business.update({
      where: { id: businessId },
      data: { gitLastPushError: message },
    });
    throw new Error(message);
  }
}
