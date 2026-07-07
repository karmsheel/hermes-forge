import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession, setActiveBusinessCookie } from '@/lib/auth';
import { deriveProjectName } from '@/lib/home-prompt';
import { formatStandardTag } from '@/lib/process-standards';
import { WELCOME_MESSAGE } from '@/lib/process-welcome';
import { categorizeWorkflow } from '@/lib/categorize-workflow';
import {
  liveOccurredNow,
  markBusinessLogInitialized,
  recordBusinessEvent,
  truncatePreview,
} from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { ensureBusinessOwner } from '@/lib/personnel/ensure-owner';

const StartFromBriefSchema = z.object({
  brief: z.string().min(1).max(5000),
  templateId: z
    .enum(['sop', 'customer-journey', 'approval-flow', 'onboarding', 'incident'])
    .optional(),
  processName: z.string().max(120).optional(),
  diagramMermaid: z.string().max(20000).optional(),
  processStandard: z.enum(['auto', 'bpmn-lite', 'swimlane', 'flowchart']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = StartFromBriefSchema.parse(await request.json());
    const trimmed = body.brief.trim();
    const templateTag = body.templateId ? `[template:${body.templateId}] ` : '';
    const standardTag = formatStandardTag(body.processStandard ?? 'auto');
    const diagramMermaid = body.diagramMermaid?.trim() || null;

    // Reuse existing active business if present (so home brief adds process to current business).
    // Only create a brand new business if the user has none yet.
    const existingBusiness = await getActiveBusinessForUser(session.userId, request);

    const { business, process } = await prisma.$transaction(async (tx) => {
      let business;
      if (existingBusiness) {
        business = existingBusiness;
      } else {
        business = await tx.business.create({
          data: {
            userId: session.userId,
            name: deriveProjectName(trimmed),
            description: trimmed,
          },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await ensureBusinessOwner(business.id, session.userId, tx);
      }

      const processTextForCat = `${body.processName || ''} ${trimmed}`;
      const createdProcess = await tx.process.create({
        data: {
          businessId: business.id,
          name: body.processName?.trim() || 'New workflow',
          description: `${templateTag}${standardTag}${trimmed}`,
          department: categorizeWorkflow(processTextForCat),
          status: 'mapping',
          diagramMermaid,
          diagramUpdatedAt: diagramMermaid ? new Date() : null,
          conversations: {
            create: { title: 'Main' },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          diagramMermaid: true,
          createdAt: true,
          updatedAt: true,
          conversations: { select: { id: true }, take: 1 },
        },
      });

      const conversationId = createdProcess.conversations[0]?.id;

      await tx.chatMessage.create({
        data: {
          processId: createdProcess.id,
          conversationId,
          role: 'assistant',
          content: WELCOME_MESSAGE,
        },
      });

      await tx.chatMessage.create({
        data: {
          processId: createdProcess.id,
          conversationId,
          role: 'user',
          content: trimmed,
        },
      });

      return { business, process: createdProcess };
    });

    if (!existingBusiness) {
      await recordBusinessEvent({
        businessId: business.id,
        userId: session.userId,
        type: BUSINESS_EVENT_TYPES.BUSINESS_CREATED,
        entityType: 'business',
        entityId: business.id,
        entityName: business.name,
        summary: `Created business "${business.name}"`,
        ...liveOccurredNow(),
      });
      await markBusinessLogInitialized(business.id);
    }

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
      entityType: 'process',
      entityId: process.id,
      entityName: process.name,
      summary: `Created process "${process.name}"`,
      ...liveOccurredNow(),
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
      entityType: 'chat',
      entityId: process.id,
      entityName: process.name,
      summary: `Message in "${process.name}"`,
      metadata: { preview: truncatePreview(trimmed), role: 'user' },
      ...liveOccurredNow(),
    });

    const response = NextResponse.json({
      businessId: business.id,
      processId: process.id,
      business,
      process,
    });
    setActiveBusinessCookie(response, business.id);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Start from brief error', error);
    return NextResponse.json({ error: 'Failed to start from brief' }, { status: 500 });
  }
}