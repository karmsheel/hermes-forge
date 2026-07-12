import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import type { BusinessLogBundleEventV1 } from '@/lib/business-log-export';
import { git, isGitAvailable } from '@/lib/business-git/exec';
import { resolveBusinessesDataRoot } from '@/lib/business-git/paths';
import {
  isBusinessRepoManifest,
  listConversationNdjson,
  listProcessDirs,
  parseChatMessages,
  parseConversationIndex,
  parseDocumentIndex,
  parsePersonnelFile,
  parseProcessMeta,
  pathExists,
  readJsonFile,
  readNdjsonFile,
  readTextFile,
  type ParsedBusinessSnapshot,
} from '@/lib/business-git/repo-files';
import type {
  BusinessGitImportCounts,
  BusinessGitImportResult,
  BusinessRepoManifestV1,
} from '@/lib/business-git/types';
import { ensureBusinessOwner } from '@/lib/personnel/ensure-owner';

export interface ImportBusinessFromGitOptions {
  userId: string;
  /** Absolute path to an already-materialized Forge business repo. */
  repoPath?: string;
  /** Clone this remote into a temp dir, then import. */
  remoteUrl?: string;
  branch?: string;
}

function emptyCounts(): BusinessGitImportCounts {
  return {
    processes: 0,
    conversations: 0,
    messages: 0,
    documents: 0,
    humans: 0,
    agents: 0,
    memories: 0,
    decisions: 0,
    automations: 0,
    logEvents: 0,
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveSourceRepo(options: ImportBusinessFromGitOptions): Promise<{
  repoPath: string;
  cleanupPath: string | null;
}> {
  if (options.repoPath?.trim()) {
    const repoPath = path.resolve(options.repoPath.trim());
    if (!(await pathExists(repoPath))) {
      throw new Error(`Repo path does not exist: ${repoPath}`);
    }
    return { repoPath, cleanupPath: null };
  }

  const remoteUrl = options.remoteUrl?.trim();
  if (!remoteUrl) {
    throw new Error('Provide a local repo path or a remote URL to import from');
  }

  if (!(await isGitAvailable())) {
    throw new Error('Git is not installed or not available on PATH');
  }

  const root = resolveBusinessesDataRoot();
  await fs.mkdir(root, { recursive: true });
  const cleanupPath = path.join(root, `_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const branch = options.branch?.trim() || 'main';

  try {
    await git(
      root,
      ['clone', '--branch', branch, '--single-branch', remoteUrl, cleanupPath],
      { cwd: root, noPrompt: true, timeoutMs: 180_000 }
    );
  } catch (first) {
    // Retry without branch (default remote HEAD) if branch name differs.
    try {
      await fs.rm(cleanupPath, { recursive: true, force: true });
    } catch {
      // ignore
    }
    try {
      await git(root, ['clone', '--single-branch', remoteUrl, cleanupPath], {
        cwd: root,
        noPrompt: true,
        timeoutMs: 180_000,
      });
    } catch (second) {
      const msg =
        second instanceof Error
          ? second.message
          : first instanceof Error
            ? first.message
            : 'Clone failed';
      throw new Error(
        `Failed to clone remote. Ensure the URL is reachable and credentials are configured. ${msg.slice(0, 300)}`
      );
    }
  }

  return { repoPath: cleanupPath, cleanupPath };
}

/**
 * Restore a business into SQLite from a Hermes Forge Git repo snapshot.
 * Creates a **new** business for `userId` (does not merge into an existing one).
 */
export async function importBusinessFromGitRepo(
  options: ImportBusinessFromGitOptions
): Promise<BusinessGitImportResult> {
  const { repoPath, cleanupPath } = await resolveSourceRepo(options);
  const counts = emptyCounts();

  try {
    const manifestRaw = await readJsonFile<unknown>(path.join(repoPath, 'manifest.json'));
    if (!isBusinessRepoManifest(manifestRaw)) {
      throw new Error(
        'Not a Hermes Forge business repo (missing or invalid manifest.json version 1)'
      );
    }
    const manifest: BusinessRepoManifestV1 = manifestRaw;

    const businessRaw =
      (await readJsonFile<ParsedBusinessSnapshot>(path.join(repoPath, 'business.json'))) ??
      ({ name: manifest.businessName } satisfies ParsedBusinessSnapshot);

    const businessName =
      (typeof businessRaw.name === 'string' && businessRaw.name.trim()) ||
      manifest.businessName ||
      'Imported business';

    const personnel = parsePersonnelFile(
      await readJsonFile(path.join(repoPath, 'personnel.json'))
    );
    const documentIndex = parseDocumentIndex(
      await readJsonFile(path.join(repoPath, 'documents', 'index.json'))
    );
    const memories = await readNdjsonFile<{
      fact?: string;
      confidence?: number;
      source?: string | null;
    }>(path.join(repoPath, 'memories.ndjson'));
    const decisions = await readNdjsonFile<{
      id?: string;
      title?: string;
      statement?: string;
      rationale?: string | null;
      context?: string | null;
      status?: string;
      decidedAt?: string | null;
      recordedAt?: string;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
      logSequence?: number | null;
    }>(path.join(repoPath, 'decisions.ndjson'));
    const logEvents = await readNdjsonFile<BusinessLogBundleEventV1>(
      path.join(repoPath, 'log', 'events.ndjson')
    );

    const processDirNames = await listProcessDirs(repoPath);
    const processSnapshots: Array<{
      oldId: string;
      meta: NonNullable<ReturnType<typeof parseProcessMeta>>;
      diagram: string;
      conversations: Array<{
        oldId: string;
        title: string;
        kind: string;
        forkedFromId: string | null;
        messages: ReturnType<typeof parseChatMessages>;
      }>;
      automation: Record<string, unknown> | null;
    }> = [];

    for (const oldProcessId of processDirNames) {
      const processDir = path.join(repoPath, 'processes', oldProcessId);
      const metaRaw = await readJsonFile(path.join(processDir, 'meta.json'));
      const meta = parseProcessMeta(metaRaw, oldProcessId);
      if (!meta) continue;
      const diagram = (await readTextFile(path.join(processDir, 'diagram.mmd'))) ?? '';
      const convIndex = parseConversationIndex(
        await readJsonFile(path.join(processDir, 'conversations', 'index.json'))
      );
      const convMetaById = new Map(convIndex.map((c) => [c.id, c]));
      const ndjsonFiles = await listConversationNdjson(processDir);
      const conversations: (typeof processSnapshots)[0]['conversations'] = [];

      for (const file of ndjsonFiles) {
        const rows = await readNdjsonFile(file.filePath);
        const messages = parseChatMessages(rows);
        const metaRow = convMetaById.get(file.conversationId);
        conversations.push({
          oldId: file.conversationId,
          title: metaRow?.title ?? 'Main',
          kind: metaRow?.kind ?? 'process',
          forkedFromId: metaRow?.forkedFromId ?? null,
          messages,
        });
      }

      // If diagram/messages exist but no conversation files, leave conversations empty
      // (workshop will create a main thread on open).
      const automation =
        (await readJsonFile<Record<string, unknown>>(
          path.join(repoPath, 'automations', oldProcessId, 'meta.json')
        )) ?? null;

      processSnapshots.push({
        oldId: oldProcessId,
        meta,
        diagram,
        conversations,
        automation,
      });
    }

    // ID maps for log entity remapping (best-effort).
    const processIdMap = new Map<string, string>();
    const decisionIdMap = new Map<string, string>();
    const documentIdMap = new Map<string, string>();
    const personnelIdMap = new Map<string, string>();

    const created = await prisma.$transaction(
      async (tx) => {
        const business = await tx.business.create({
          data: {
            userId: options.userId,
            name: businessName.slice(0, 120),
            industry:
              typeof businessRaw.industry === 'string' ? businessRaw.industry.slice(0, 100) : null,
            description:
              typeof businessRaw.description === 'string'
                ? businessRaw.description.slice(0, 5000)
                : null,
            teamSize: typeof businessRaw.teamSize === 'number' ? businessRaw.teamSize : null,
            website: typeof businessRaw.website === 'string' ? businessRaw.website : null,
            goals: typeof businessRaw.goals === 'string' ? businessRaw.goals : null,
            constraints:
              typeof businessRaw.constraints === 'string' ? businessRaw.constraints : null,
            // log head set after events import
            logHeadSequence: 0,
          },
        });

        // Personnel humans
        let ownerImported = false;
        for (const human of personnel.humans) {
          const row = await tx.humanPersonnel.create({
            data: {
              businessId: business.id,
              name: human.name.slice(0, 200),
              role: human.role.slice(0, 200),
              roleDescription: human.roleDescription ?? null,
              isOwner: Boolean(human.isOwner),
              // Rebind owner to the importing user
              userId: human.isOwner ? options.userId : null,
              iconKey: human.iconKey ?? null,
            },
          });
          if (human.id) personnelIdMap.set(human.id, row.id);
          if (human.isOwner) ownerImported = true;
          counts.humans += 1;
        }

        if (!ownerImported) {
          await ensureBusinessOwner(business.id, options.userId, tx);
        } else {
          // Ensure owner name stays current; ensureBusinessOwner is a no-op if owner exists
          await ensureBusinessOwner(business.id, options.userId, tx);
        }

        // Agents (dedupe by profileKey)
        const seenProfileKeys = new Set<string>();
        for (const agent of personnel.agents) {
          const profileKey = agent.profileKey.slice(0, 200);
          if (seenProfileKeys.has(profileKey)) continue;
          seenProfileKeys.add(profileKey);
          const row = await tx.hermesAgentProfile.create({
            data: {
              businessId: business.id,
              profileKey,
              displayName: agent.displayName.slice(0, 200),
              description: agent.description ?? null,
              model: agent.model ?? null,
              hermesHome: agent.hermesHome?.trim() || 'imported',
              isDefault: Boolean(agent.isDefault),
              iconKey: agent.iconKey ?? null,
              isHired: Boolean(agent.isHired),
              hiredAt: parseDate(agent.hiredAt ?? null),
            },
          });
          if (agent.id) personnelIdMap.set(agent.id, row.id);
          counts.agents += 1;
        }

        // Documents
        for (const doc of documentIndex) {
          const body =
            (await readTextFile(path.join(repoPath, 'documents', `${doc.slug}.md`))) ?? '';
          const row = await tx.businessDocument.create({
            data: {
              businessId: business.id,
              title: doc.title.slice(0, 200),
              kind: doc.kind,
              slug: doc.slug.slice(0, 120),
              bodyMarkdown: body,
              pinnedForContext: Boolean(doc.pinnedForContext),
              sortOrder: doc.sortOrder ?? 0,
              source: doc.source === 'seed' ? 'seed' : 'import',
            },
          });
          if (doc.id) documentIdMap.set(doc.id, row.id);
          counts.documents += 1;
        }

        // Memories
        for (const m of memories) {
          if (typeof m.fact !== 'string' || !m.fact.trim()) continue;
          await tx.memory.create({
            data: {
              businessId: business.id,
              fact: m.fact,
              confidence: typeof m.confidence === 'number' ? m.confidence : 0.8,
              source: m.source ?? 'import',
            },
          });
          counts.memories += 1;
        }

        // Processes + conversations + automations
        for (const snap of processSnapshots) {
          const proc = await tx.process.create({
            data: {
              businessId: business.id,
              name: snap.meta.name.slice(0, 200),
              description: snap.meta.description ?? '',
              department: snap.meta.department ?? 'Operations',
              trigger: snap.meta.trigger ?? null,
              inputs: snap.meta.inputs ?? null,
              outputs: snap.meta.outputs ?? null,
              manualSteps: snap.meta.manualSteps ?? null,
              automationScore: snap.meta.automationScore ?? 0,
              estimatedTimeSaved: snap.meta.estimatedTimeSaved ?? null,
              repetition: snap.meta.repetition ?? null,
              businessValue: snap.meta.businessValue ?? null,
              complexity: snap.meta.complexity ?? null,
              status: snap.meta.status ?? 'mapping',
              approvedAt: parseDate(snap.meta.approvedAt ?? null),
              nameStatus: snap.meta.nameStatus ?? 'confirmed',
              diagramMermaid: snap.diagram.trim() ? snap.diagram : null,
              diagramUpdatedAt: snap.diagram.trim() ? new Date() : null,
            },
          });
          processIdMap.set(snap.oldId, proc.id);
          if (snap.meta.id) processIdMap.set(snap.meta.id, proc.id);
          counts.processes += 1;

          const conversationIdMap = new Map<string, string>();
          for (const conv of snap.conversations) {
            const createdConv = await tx.conversation.create({
              data: {
                businessId: business.id,
                processId: proc.id,
                kind: conv.kind === 'studio' ? 'studio' : 'process',
                title: conv.title.slice(0, 200) || 'Main',
              },
            });
            conversationIdMap.set(conv.oldId, createdConv.id);
            counts.conversations += 1;

            if (conv.messages.length > 0) {
              await tx.chatMessage.createMany({
                data: conv.messages.map((m) => ({
                  processId: proc.id,
                  conversationId: createdConv.id,
                  role: m.role,
                  content: m.content,
                  ...(parseDate(m.createdAt ?? null)
                    ? { createdAt: parseDate(m.createdAt ?? null)! }
                    : {}),
                })),
              });
              counts.messages += conv.messages.length;
            }
          }

          // Patch forkedFromId after all conversations for this process exist
          for (const conv of snap.conversations) {
            if (!conv.forkedFromId) continue;
            const newId = conversationIdMap.get(conv.oldId);
            const newParent = conversationIdMap.get(conv.forkedFromId);
            if (newId && newParent) {
              await tx.conversation.update({
                where: { id: newId },
                data: { forkedFromId: newParent },
              });
            }
          }

          if (snap.automation) {
            const a = snap.automation;
            // Prefer remapped profile id; fall back to profileKey match among imported agents.
            let agentId: string | null = null;
            if (typeof a.hermesAgentProfileId === 'string' && personnelIdMap.has(a.hermesAgentProfileId)) {
              agentId = personnelIdMap.get(a.hermesAgentProfileId)!;
            } else if (typeof a.hermesAgentProfileKey === 'string') {
              const byKey = await tx.hermesAgentProfile.findFirst({
                where: { businessId: business.id, profileKey: a.hermesAgentProfileKey },
                select: { id: true },
              });
              agentId = byKey?.id ?? null;
            }
            await tx.automation.create({
              data: {
                processId: proc.id,
                type: typeof a.type === 'string' ? a.type : null,
                status: typeof a.status === 'string' ? a.status : 'designing',
                planJson: typeof a.planJson === 'string' ? a.planJson : null,
                integrationsJson:
                  typeof a.integrationsJson === 'string' ? a.integrationsJson : null,
                credentialMapJson:
                  typeof a.credentialMapJson === 'string' ? a.credentialMapJson : null,
                externalId: typeof a.externalId === 'string' ? a.externalId : null,
                externalUrl: typeof a.externalUrl === 'string' ? a.externalUrl : null,
                deployedAt: parseDate(typeof a.deployedAt === 'string' ? a.deployedAt : null),
                hermesAgentProfileId: agentId,
              },
            });
            counts.automations += 1;
          }
        }

        // Decisions after processes so relatedEntityId can remap
        for (const d of decisions) {
          if (typeof d.title !== 'string' || !d.title.trim()) continue;
          if (typeof d.statement !== 'string' || !d.statement.trim()) continue;
          let relatedEntityId = d.relatedEntityId ?? null;
          if (
            relatedEntityId &&
            d.relatedEntityType === 'process' &&
            processIdMap.has(relatedEntityId)
          ) {
            relatedEntityId = processIdMap.get(relatedEntityId)!;
          }
          const row = await tx.businessDecision.create({
            data: {
              businessId: business.id,
              title: d.title.slice(0, 300),
              statement: d.statement,
              rationale: d.rationale ?? null,
              context: d.context ?? null,
              status: d.status === 'superseded' || d.status === 'revoked' ? d.status : 'active',
              decidedAt: parseDate(d.decidedAt ?? null),
              recordedAt: parseDate(d.recordedAt) ?? new Date(),
              relatedEntityType: d.relatedEntityType ?? null,
              relatedEntityId,
              logSequence: typeof d.logSequence === 'number' ? d.logSequence : null,
            },
          });
          if (typeof d.id === 'string') decisionIdMap.set(d.id, row.id);
          counts.decisions += 1;
        }

        // Business log events (archive trail). Remap known process entity IDs.
        let maxSeq = 0;
        for (const ev of logEvents) {
          if (typeof ev.sequence !== 'number' || typeof ev.type !== 'string') continue;
          if (typeof ev.summary !== 'string') continue;
          let entityId = typeof ev.entityId === 'string' ? ev.entityId : null;
          if (entityId && ev.entityType === 'process' && processIdMap.has(entityId)) {
            entityId = processIdMap.get(entityId)!;
          } else if (entityId && ev.entityType === 'document' && documentIdMap.has(entityId)) {
            entityId = documentIdMap.get(entityId)!;
          } else if (entityId && ev.entityType === 'personnel' && personnelIdMap.has(entityId)) {
            entityId = personnelIdMap.get(entityId)!;
          } else if (entityId && ev.entityType === 'decision' && decisionIdMap.has(entityId)) {
            entityId = decisionIdMap.get(entityId)!;
          } else if (entityId && ev.entityType === 'business') {
            entityId = business.id;
          }

          const recordedAt = parseDate(ev.recordedAt) ?? new Date();
          await tx.businessEvent.create({
            data: {
              businessId: business.id,
              userId: options.userId,
              sequence: ev.sequence,
              type: ev.type,
              entityType: typeof ev.entityType === 'string' ? ev.entityType : null,
              entityId,
              entityName: typeof ev.entityName === 'string' ? ev.entityName : null,
              summary: ev.summary,
              metadata: ev.metadata ? JSON.stringify(ev.metadata) : null,
              recordedAt,
              occurredAt: parseDate(ev.occurredAt),
              occurredAtPrecision:
                typeof ev.occurredAtPrecision === 'string' ? ev.occurredAtPrecision : 'unknown',
              ingestion: 'import',
            },
          });
          maxSeq = Math.max(maxSeq, ev.sequence);
          counts.logEvents += 1;
        }

        // Append a live "imported" event after archived log tail
        const importSeq = maxSeq + 1;
        await tx.businessEvent.create({
          data: {
            businessId: business.id,
            userId: options.userId,
            sequence: importSeq,
            type: BUSINESS_EVENT_TYPES.BUSINESS_IMPORTED,
            entityType: 'business',
            entityId: business.id,
            entityName: business.name,
            summary: `Restored business "${business.name}" from Git snapshot`,
            metadata: JSON.stringify({
              source: 'git',
              processes: counts.processes,
              documents: counts.documents,
              humans: counts.humans,
              agents: counts.agents,
            }),
            recordedAt: new Date(),
            occurredAt: new Date(),
            occurredAtPrecision: 'exact',
            ingestion: 'import',
          },
        });

        await tx.business.update({
          where: { id: business.id },
          data: {
            logHeadSequence: importSeq,
            logInitializedAt: new Date(),
            gitDirty: true,
          },
        });

        return business;
      },
      { timeout: 120_000 }
    );

    // Best-effort: materialize a fresh local mirror for the new business.
    // Dynamic import avoids circular dependency (sync → materialize → not import).
    try {
      const { syncBusinessGitRepo } = await import('@/lib/business-git/sync');
      const user = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { email: true, name: true },
      });
      await syncBusinessGitRepo(created.id, {
        userEmail: user?.email,
        userName: user?.name,
      });
    } catch {
      // non-fatal — DB restore already succeeded
    }

    // If import was from a remote clone, set remote on the new business for future push.
    if (options.remoteUrl?.trim()) {
      await prisma.business.update({
        where: { id: created.id },
        data: {
          gitRemoteUrl: options.remoteUrl.trim(),
          gitRemoteBranch: options.branch?.trim() || 'main',
        },
      });
    }

    return {
      ok: true,
      businessId: created.id,
      businessName: created.name,
      counts,
      sourcePath: repoPath,
      message: `Imported "${created.name}" (${counts.processes} processes, ${counts.documents} documents, ${counts.humans} humans, ${counts.agents} agents)`,
    };
  } finally {
    if (cleanupPath) {
      try {
        await fs.rm(cleanupPath, { recursive: true, force: true });
      } catch {
        // leave temp clone for inspection on failure
      }
    }
  }
}

/** Convenience re-export for callers that only need path validation. */
export { isBusinessRepoManifest, pathExists };
