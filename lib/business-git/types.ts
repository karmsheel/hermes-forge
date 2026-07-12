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

export interface BusinessGitPushResult {
  ok: boolean;
  pushed: boolean;
  headCommit: string | null;
  remoteUrl: string;
  remoteBranch: string;
  message: string;
  lastPushedAt: string | null;
}

export interface BusinessGitImportCounts {
  processes: number;
  conversations: number;
  messages: number;
  documents: number;
  humans: number;
  agents: number;
  memories: number;
  decisions: number;
  automations: number;
  logEvents: number;
}

export interface BusinessGitImportResult {
  ok: boolean;
  businessId: string;
  businessName: string;
  counts: BusinessGitImportCounts;
  sourcePath: string;
  message: string;
}

/** Conversation meta written alongside message ndjson for round-trip import. */
export interface ConversationExportMetaV1 {
  id: string;
  title: string;
  kind: string;
  forkedFromId: string | null;
  createdAt: string;
  updatedAt: string;
}
