import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { refreshBusinessAutomationHealth } from '@/lib/automation-control';
import type { AutomationRunHealth } from '@/lib/automation-run-health';
import { automationStatusToDeployStatus } from '@/lib/automation-types';
import {
  getClaimedJobIdsForBusiness,
  listHermesJobsSafe,
  syncAutomationCronLink,
} from '@/lib/automation-sync';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const SyncSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ linkedCount: 0, processes: [], business: null });
    }

    const body = SyncSchema.parse(await request.json());

    const processes = await prisma.process.findMany({
      where: {
        businessId: business.id,
        status: { in: ['forged', 'approved'] },
      },
      orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        department: true,
        status: true,
        approvedAt: true,
        nameStatus: true,
        diagramMermaid: true,
        diagramUpdatedAt: true,
        trigger: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
        automation: {
          select: {
            id: true,
            status: true,
            type: true,
            externalId: true,
            hermesAgentProfileId: true,
            hermesAgentProfile: {
              select: { id: true, displayName: true, profileKey: true },
            },
          },
        },
      },
    });

    const jobs = await listHermesJobsSafe(body.baseUrl, body.apiKey);
    const claimedJobIds = await getClaimedJobIdsForBusiness(business.id);

    let linkedCount = 0;

    for (const proc of processes) {
      if (!proc.automation || proc.automation.externalId) continue;

      const syncResult = await syncAutomationCronLink({
        automationId: proc.automation.id,
        processName: proc.name,
        jobs,
        claimedJobIds,
      });

      if (syncResult.linked && syncResult.jobId) {
        linkedCount += 1;
        claimedJobIds.add(syncResult.jobId);
        proc.automation = {
          ...proc.automation,
          type: 'hermes_cron',
          status: 'active',
          externalId: syncResult.jobId,
        };
        await recordBusinessEvent({
          businessId: business.id,
          userId: session.userId,
          type: BUSINESS_EVENT_TYPES.AUTOMATION_SYNCED,
          entityType: 'automation',
          entityId: proc.id,
          entityName: proc.name,
          summary: `Synced Hermes cron for "${proc.name}"`,
          ...liveOccurredNow(),
        });
      }
    }

    // Refresh run health for already-deployed Hermes crons (7.1)
    let healthByProcess = new Map<string, AutomationRunHealth>();
    try {
      healthByProcess = await refreshBusinessAutomationHealth({
        businessId: business.id,
        baseUrl: body.baseUrl,
        apiKey: body.apiKey,
      });
    } catch (error) {
      console.error('Batch health refresh failed', error);
    }

    // Re-read automation status after health updates
    const statusRows = await prisma.automation.findMany({
      where: { processId: { in: processes.map((p) => p.id) } },
      select: {
        processId: true,
        status: true,
        type: true,
        externalId: true,
        hermesAgentProfileId: true,
        hermesAgentProfile: {
          select: { id: true, displayName: true, profileKey: true },
        },
      },
    });
    const statusByProcess = new Map(statusRows.map((r) => [r.processId, r]));

    const items = processes.map((process: (typeof processes)[0]) => {
      const automation = statusByProcess.get(process.id) ?? process.automation;
      const health = healthByProcess.get(process.id) ?? null;
      return {
        id: process.id,
        name: process.name,
        description: process.description,
        department: process.department,
        status: process.status,
        approvedAt: process.approvedAt,
        nameStatus: process.nameStatus,
        diagramMermaid: process.diagramMermaid,
        diagramUpdatedAt: process.diagramUpdatedAt,
        trigger: process.trigger,
        updatedAt: process.updatedAt,
        createdAt: process.createdAt,
        _count: process._count,
        automationStatus: automationStatusToDeployStatus(
          automation as { status: string; type: string | null; externalId?: string | null } | null
        ),
        runtimeStatus: automation?.status ?? null,
        externalId: automation?.externalId ?? null,
        automationType: automation?.type ?? null,
        runHealth: health,
        assignedAgent: automation?.hermesAgentProfile
          ? {
              id: automation.hermesAgentProfile.id,
              displayName: automation.hermesAgentProfile.displayName,
              profileKey: automation.hermesAgentProfile.profileKey,
            }
          : null,
      };
    });

    return NextResponse.json({
      linkedCount,
      processes: items,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('Automations batch sync error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}