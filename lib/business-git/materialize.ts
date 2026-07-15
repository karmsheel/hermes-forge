import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  businessEventRowToBundleEvent,
  computeBundleChecksum,
  serializeLogEventLine,
} from '@/lib/business-log-export';
import type { BusinessRepoManifestV1 } from '@/lib/business-git/types';
import { buildProcessMdFromBusiness } from '@/lib/process-md';

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeNdjson(filePath: string, lines: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const body = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  await fs.writeFile(filePath, body, 'utf8');
}

export interface MaterializeResult {
  manifest: BusinessRepoManifestV1;
  logEventCount: number;
}

export async function materializeBusinessRepo(
  repoPath: string,
  businessId: string,
  gitHeadCommit: string | null
): Promise<MaterializeResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      processes: {
        include: {
          conversations: {
            include: {
              messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { createdAt: 'asc' },
          },
          automation: {
            include: {
              hermesAgentProfile: { select: { id: true, profileKey: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      memories: { orderBy: { lastUpdated: 'asc' } },
      documents: { orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] },
      humanPersonnel: { orderBy: { createdAt: 'asc' } },
      hermesAgentProfiles: { orderBy: { discoveredAt: 'asc' } },
      decisions: { orderBy: { recordedAt: 'asc' } },
      decisionRequests: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { sequence: 'asc' } },
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const bundleEvents = business.events.map(businessEventRowToBundleEvent);
  const logChecksum = computeBundleChecksum(bundleEvents);
  const exportedAt = new Date().toISOString();

  const manifest: BusinessRepoManifestV1 = {
    version: 1,
    businessId: business.id,
    businessName: business.name,
    exportedAt,
    logHeadSequence: business.logHeadSequence,
    logChecksum,
    gitHeadCommit,
  };

  await writeJson(path.join(repoPath, 'manifest.json'), manifest);

  await writeJson(path.join(repoPath, 'business.json'), {
    id: business.id,
    name: business.name,
    industry: business.industry,
    description: business.description,
    teamSize: business.teamSize,
    website: business.website,
    goals: business.goals,
    constraints: business.constraints,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  });

  // 4.2 — durable process mapping contract for agents + Git consumers
  await writeText(
    path.join(repoPath, 'PROCESS.md'),
    buildProcessMdFromBusiness({
      name: business.name,
      description: business.description,
      industry: business.industry,
      goals: business.goals,
      constraints: business.constraints,
      processes: business.processes.map((p) => ({
        name: p.name,
        department: p.department,
        status: p.status,
        description: p.description,
        trigger: p.trigger,
        inputs: p.inputs,
        outputs: p.outputs,
        manualSteps: p.manualSteps,
        ioShape: p.ioShape,
      })),
      humanPersonnel: business.humanPersonnel.map((h) => ({
        name: h.name,
        role: h.role,
      })),
      hermesAgentProfiles: business.hermesAgentProfiles.map((a) => ({
        displayName: a.displayName,
        description: a.description,
        isHired: a.isHired,
      })),
    })
  );

  await writeNdjson(
    path.join(repoPath, 'memories.ndjson'),
    business.memories.map((m) =>
      JSON.stringify({
        id: m.id,
        fact: m.fact,
        confidence: m.confidence,
        source: m.source,
        lastUpdated: m.lastUpdated.toISOString(),
      })
    )
  );

  // 4.18 — business knowledge documents
  await writeJson(
    path.join(repoPath, 'documents', 'index.json'),
    business.documents.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      slug: d.slug,
      pinnedForContext: d.pinnedForContext,
      sortOrder: d.sortOrder,
      source: d.source,
      lifecycleStatus: d.lifecycleStatus,
      forgedAt: d.forgedAt?.toISOString() ?? null,
      updatedAt: d.updatedAt.toISOString(),
    }))
  );
  for (const d of business.documents) {
    await writeText(
      path.join(repoPath, 'documents', `${d.slug}.md`),
      d.bodyMarkdown.endsWith('\n') ? d.bodyMarkdown : `${d.bodyMarkdown}\n`
    );
  }

  await writeJson(path.join(repoPath, 'personnel.json'), {
    humans: business.humanPersonnel.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      roleDescription: p.roleDescription,
      isOwner: p.isOwner,
      userId: p.userId,
      iconKey: p.iconKey,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    agents: business.hermesAgentProfiles.map((a) => ({
      id: a.id,
      profileKey: a.profileKey,
      displayName: a.displayName,
      description: a.description,
      model: a.model,
      hermesHome: a.hermesHome,
      isDefault: a.isDefault,
      iconKey: a.iconKey,
      isHired: a.isHired,
      hiredAt: a.hiredAt?.toISOString() ?? null,
      discoveredAt: a.discoveredAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });

  await writeNdjson(
    path.join(repoPath, 'decisions.ndjson'),
    business.decisions.map((d) =>
      JSON.stringify({
        id: d.id,
        title: d.title,
        statement: d.statement,
        rationale: d.rationale,
        context: d.context,
        kind: d.kind,
        status: d.status,
        decidedAt: d.decidedAt?.toISOString() ?? null,
        recordedAt: d.recordedAt.toISOString(),
        relatedEntityType: d.relatedEntityType,
        relatedEntityId: d.relatedEntityId,
        supersededByDecisionId: d.supersededByDecisionId,
        sourceRequestId: d.sourceRequestId,
        logSequence: d.logSequence,
      })
    )
  );

  // Pending + recent decision requests (4.12 HITL)
  if ('decisionRequests' in business && Array.isArray((business as { decisionRequests?: unknown[] }).decisionRequests)) {
    const requests = (business as {
      decisionRequests: Array<{
        id: string;
        title: string;
        summary: string;
        contextMarkdown: string;
        status: string;
        urgency: string;
        proposerKind: string;
        hermesAgentProfileId: string | null;
        conversationId: string | null;
        relatedEntityType: string | null;
        relatedEntityId: string | null;
        relatedEntityName: string | null;
        optionsJson: string;
        proposedActionsJson: string;
        selectedOptionId: string | null;
        redirectMessage: string | null;
        resolvedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }).decisionRequests;
    await writeNdjson(
      path.join(repoPath, 'decision-requests.ndjson'),
      requests.map((r) =>
        JSON.stringify({
          id: r.id,
          title: r.title,
          summary: r.summary,
          contextMarkdown: r.contextMarkdown,
          status: r.status,
          urgency: r.urgency,
          proposerKind: r.proposerKind,
          hermesAgentProfileId: r.hermesAgentProfileId,
          conversationId: r.conversationId,
          relatedEntityType: r.relatedEntityType,
          relatedEntityId: r.relatedEntityId,
          relatedEntityName: r.relatedEntityName,
          optionsJson: r.optionsJson,
          proposedActionsJson: r.proposedActionsJson,
          selectedOptionId: r.selectedOptionId,
          redirectMessage: r.redirectMessage,
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })
      )
    );
  }

  for (const process of business.processes) {
    const processDir = path.join(repoPath, 'processes', process.id);
    await writeJson(path.join(processDir, 'meta.json'), {
      id: process.id,
      name: process.name,
      description: process.description,
      department: process.department,
      trigger: process.trigger,
      inputs: process.inputs,
      outputs: process.outputs,
      manualSteps: process.manualSteps,
      automationScore: process.automationScore,
      estimatedTimeSaved: process.estimatedTimeSaved,
      repetition: process.repetition,
      businessValue: process.businessValue,
      complexity: process.complexity,
      status: process.status,
      approvedAt: process.approvedAt?.toISOString() ?? null,
      nameStatus: process.nameStatus,
      ioShape: process.ioShape ?? 'siso',
      diagramUpdatedAt: process.diagramUpdatedAt?.toISOString() ?? null,
      createdAt: process.createdAt.toISOString(),
      updatedAt: process.updatedAt.toISOString(),
    });

    await writeText(
      path.join(processDir, 'diagram.mmd'),
      process.diagramMermaid ?? ''
    );

    // Conversation index enables title/kind/fork restore on import (4.11).
    await writeJson(
      path.join(processDir, 'conversations', 'index.json'),
      process.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        kind: c.kind,
        forkedFromId: c.forkedFromId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );

    for (const conversation of process.conversations) {
      await writeNdjson(
        path.join(processDir, 'conversations', `${conversation.id}.ndjson`),
        conversation.messages.map((m) =>
          JSON.stringify({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })
        )
      );
    }

    if (process.automation) {
      const automation = process.automation;
      await writeJson(path.join(repoPath, 'automations', process.id, 'meta.json'), {
        id: automation.id,
        processId: automation.processId,
        type: automation.type,
        status: automation.status,
        externalId: automation.externalId,
        externalUrl: automation.externalUrl,
        deployedAt: automation.deployedAt?.toISOString() ?? null,
        createdAt: automation.createdAt.toISOString(),
        updatedAt: automation.updatedAt.toISOString(),
        planJson: automation.planJson,
        integrationsJson: automation.integrationsJson,
        credentialMapJson: automation.credentialMapJson,
        hermesAgentProfileId: automation.hermesAgentProfileId,
        hermesAgentProfileKey: automation.hermesAgentProfile?.profileKey ?? null,
      });
    }
  }

  await writeNdjson(
    path.join(repoPath, 'log', 'events.ndjson'),
    bundleEvents.map(serializeLogEventLine)
  );

  return { manifest, logEventCount: bundleEvents.length };
}