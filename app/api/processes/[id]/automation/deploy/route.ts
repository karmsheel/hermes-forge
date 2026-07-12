import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  buildAutomationStudioData,
  getOrCreateAutomation,
  loadAutomationWithRelations,
  requireApprovedProcessAccess,
  toAgentSummary,
} from '@/lib/automation-access';
import {
  buildCronPrompt,
  defaultCronDeliver,
  defaultCronSchedule,
} from '@/lib/automation-deploy';
import {
  findMatchingHermesJob,
  forgeJobNameForProcess,
  getClaimedJobIdsForBusiness,
  listHermesJobsSafe,
} from '@/lib/automation-sync';
import { createHermesJob } from '@/lib/hermes-jobs';
import { createN8nWorkflow } from '@/lib/n8n-client';
import { generateN8nWorkflow } from '@/lib/n8n-workflow-gen';
import { parseAutomationPlan, parseCredentialMap, parseIntegrations } from '@/lib/automation-types';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';

const DeploySchema = z.object({
  type: z.enum(['hermes_cron', 'n8n_workflow']),
  hermesBaseUrl: z.string(),
  hermesApiKey: z.string(),
  n8nBaseUrl: z.string().optional(),
  n8nApiKey: z.string().optional(),
  schedule: z.string().optional(),
  deliver: z.string().optional(),
  /** Optional override; defaults to automation.hermesAgentProfileId. */
  hermesAgentProfileId: z.string().min(1).optional().nullable(),
  credentialMap: z.record(z.string(), z.object({ id: z.string(), name: z.string(), type: z.string().optional() })).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = DeploySchema.parse(await request.json());

    const result = await requireApprovedProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    let automation = await getOrCreateAutomation(id, { userId: result.session.userId });
    const plan = parseAutomationPlan(automation.planJson);
    if (!plan?.summary) {
      return NextResponse.json(
        { error: 'Design the automation in chat before deploying' },
        { status: 400 }
      );
    }

    if (automation.externalId) {
      return NextResponse.json(
        { error: 'Automation already deployed. Open the external link to manage it.' },
        { status: 409 }
      );
    }

    // Persist agent override from deploy payload when provided
    if (body.hermesAgentProfileId !== undefined) {
      if (body.hermesAgentProfileId) {
        const agent = await prisma.hermesAgentProfile.findFirst({
          where: {
            id: body.hermesAgentProfileId,
            businessId: process.businessId,
            isHired: true,
          },
        });
        if (!agent) {
          return NextResponse.json(
            { error: 'Select a hired Hermes agent before deploying' },
            { status: 400 }
          );
        }
      }
      await prisma.automation.update({
        where: { id: automation.id },
        data: { hermesAgentProfileId: body.hermesAgentProfileId },
      });
      automation = await loadAutomationWithRelations(automation.id);
    }

    const integrations = parseIntegrations(automation.integrationsJson);
    const credentialMap = body.credentialMap ?? parseCredentialMap(automation.credentialMapJson);

    if (body.type === 'n8n_workflow') {
      if (!body.n8nBaseUrl || !body.n8nApiKey) {
        return NextResponse.json({ error: 'n8n connection required' }, { status: 400 });
      }

      const unmapped = integrations.filter((i) => !credentialMap[i.name]?.id);
      if (integrations.length > 0 && unmapped.length > 0) {
        return NextResponse.json(
          {
            error: `Map credentials for: ${unmapped.map((i) => i.name).join(', ')}`,
          },
          { status: 400 }
        );
      }

      const generated = await generateN8nWorkflow(
        { baseUrl: body.hermesBaseUrl, apiKey: body.hermesApiKey },
        {
          processName: process.name,
          description: process.description,
          trigger: process.trigger,
          diagramMermaid: process.diagramMermaid,
          plan,
          integrations,
          credentialMap,
        }
      );

      const { workflowId, editorUrl } = await createN8nWorkflow(body.n8nBaseUrl, body.n8nApiKey, {
        name: generated.name,
        nodes: generated.nodes,
        connections: generated.connections,
        settings: generated.settings,
        active: false,
      });

      await prisma.automation.update({
        where: { id: automation.id },
        data: {
          type: 'n8n_workflow',
          status: 'needs_credentials',
          credentialMapJson: JSON.stringify(credentialMap),
          externalId: workflowId,
          externalUrl: editorUrl,
          deployedAt: new Date(),
        },
      });
      const updated = await loadAutomationWithRelations(automation.id);

      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.AUTOMATION_DEPLOYED,
        entityType: 'automation',
        entityId: id,
        entityName: process.name,
        summary: `Deployed n8n automation for "${process.name}"`,
        metadata: {
          type: 'n8n_workflow',
          status: 'needs_credentials',
          agentId: updated.hermesAgentProfileId ?? undefined,
        },
        ...liveOccurredNow(),
      });

      return NextResponse.json({
        studio: await buildAutomationStudioData(process, updated),
        deploy: { type: 'n8n_workflow', workflowId, editorUrl },
      });
    }

    // Hermes cron — prefer a hired agent so the job has an identity
    const assignedAgent =
      toAgentSummary(automation.hermesAgentProfile) ??
      (automation.hermesAgentProfileId
        ? toAgentSummary(
            await prisma.hermesAgentProfile.findFirst({
              where: {
                id: automation.hermesAgentProfileId,
                businessId: process.businessId,
                isHired: true,
              },
            })
          )
        : null);

    if (!assignedAgent) {
      return NextResponse.json(
        {
          error:
            'Assign a hired Hermes agent before deploying a cron job. Hire agents from Personnel, then select one in Deploy.',
        },
        { status: 400 }
      );
    }

    const schedule = body.schedule ?? defaultCronSchedule(plan);
    const deliver = body.deliver ?? defaultCronDeliver(plan);
    const prompt = buildCronPrompt(process, plan, assignedAgent);
    const jobName = forgeJobNameForProcess(process.name);

    const [jobs, claimedJobIds] = await Promise.all([
      listHermesJobsSafe(body.hermesBaseUrl, body.hermesApiKey),
      getClaimedJobIdsForBusiness(process.businessId),
    ]);

    const existingJob = await findMatchingHermesJob(process.name, jobs, claimedJobIds);
    let jobId: string;

    if (existingJob) {
      jobId = existingJob.id;
    } else {
      const created = await createHermesJob(body.hermesBaseUrl, body.hermesApiKey, {
        schedule,
        prompt,
        name: jobName,
        deliver,
      });
      jobId = created.jobId;
    }

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        type: 'hermes_cron',
        status: 'active',
        externalId: jobId,
        externalUrl: null,
        deployedAt: new Date(),
        hermesAgentProfileId: assignedAgent.id,
      },
    });
    const updated = await loadAutomationWithRelations(automation.id);

    await recordBusinessEvent({
      businessId: process.businessId,
      userId: result.session.userId,
      type: BUSINESS_EVENT_TYPES.AUTOMATION_DEPLOYED,
      entityType: 'automation',
      entityId: id,
      entityName: process.name,
      summary: `Deployed Hermes cron for "${process.name}" (agent: ${assignedAgent.displayName})`,
      metadata: {
        type: 'hermes_cron',
        status: 'active',
        agentId: assignedAgent.id,
        agentName: assignedAgent.displayName,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json({
      studio: await buildAutomationStudioData(process, updated),
      deploy: {
        type: 'hermes_cron',
        jobId,
        schedule,
        deliver,
        linkedExisting: Boolean(existingJob),
        agentId: assignedAgent.id,
        agentName: assignedAgent.displayName,
      },
    });
  } catch (error) {
    console.error('Automation deploy error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deploy failed' },
      { status: 502 }
    );
  }
}