export interface BusinessRepoManifestV1 {
  version: 1;
  businessId: string;
  businessName: string;
  exportedAt: string;
  logHeadSequence: number;
  logChecksum: string;
  gitHeadCommit: string | null;
}

export interface BusinessGitStatus {
  gitAvailable: boolean;
  initialized: boolean;
  dirty: boolean;
  repoPath: string | null;
  headCommit: string | null;
  headSequence: number | null;
  logHeadSequence: number;
  initializedAt: string | null;
  remoteUrl: string | null;
  remoteBranch: string | null;
  lastPushedAt: string | null;
  lastPushError: string | null;
}

export interface BusinessGitSyncResult {
  ok: boolean;
  committed: boolean;
  headCommit: string | null;
  headSequence: number;
  logHeadSequence: number;
  message: string;
  repoPath: string;
}