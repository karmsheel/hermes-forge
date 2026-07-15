import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { callHermes } from '@/lib/hermes';
import { buildChatSystemPrompt } from '@/lib/diagram';
import { formatDiscoveryContext, pickDiscoveryFields } from '@/lib/process-discovery';
import { buildProcessMdFromBusiness } from '@/lib/process-md';
import { loadDocumentsForPrompt } from '@/lib/documents';
import { loadPersonnelRoster } from '@/lib/personnel/load-roster';
import { requireProcessAccess } from '@/lib/auth';
import { buildApprovalUpdate } from '@/lib/process-approve';
import {
  assistantAskedAccuracyQuestion,
  shouldPromptForAccuracy,
  userConfirmsAccuracy,
} from '@/lib/process-approval';
import {
  analyzeProcessSplit,
  executeProcessSplit,
  formatSplitAnalysisForPrompt,
  shouldExecuteSplit,
} from '@/lib/process-split';
import { extractSystemsFromFields } from '@/lib/systems';
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { buildNodeCommentPrefix } from '@/lib/node-comment';

const ChatSchema = z
  .object({
    content: z.string().min(1).optional(),
    replyOnly: z.boolean().optional(),
    conversationId: z.string().optional(),
    baseUrl: z.string(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    // 3.2: explicit node targeting for corrections
    nodeContext: z
      .object({
        nodeId: z.string().optional(),
        label: z.string(),
      })
      .optional(),
  })
  .refine((data) => data.replyOnly === true || !!data.content?.trim(), {
    message: 'content is required unless replyOnly is true',
  });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());

    const result = await requireProcessAccess(request, id);
    if ('error' in result) return result.error;
    const process = result.process;

    // 3.4: Filter messages to the active conversation
    const conversationId = body.conversationId || process.conversations?.[0]?.id || null;
    const conversationMessages = conversationId
      ? process.messages.filter((m: typeof process.messages[0]) => m.conversationId === conversationId)
      : process.messages;

    const replyOnly = body.replyOnly === true;
    let allMessages = conversationMessages.map((m: typeof process.messages[0]) => ({ role: m.role, content: m.content }));

    const priorMessages = allMessages;
    const lastAssistant = [...priorMessages].reverse().find((m: { role: string }) => m.role === 'assistant');

    let approvedFromChat = false;
    if (
      !replyOnly &&
      process.status !== 'approved' &&
      process.status !== 'forged' &&
      lastAssistant &&
      assistantAskedAccuracyQuestion(lastAssistant.content) &&
      userConfirmsAccuracy(body.content!)
    ) {
      approvedFromChat = true;
      const { forgeProcessDirect } = await import('@/lib/decisions/service');
      await forgeProcessDirect({
        businessId: process.businessId,
        userId: result.session.userId,
        processId: id,
      });
    }

    if (replyOnly) {
      const last = allMessages[allMessages.length - 1];
      if (!last || last.role !== 'user') {
        return NextResponse.json(
          { error: 'No user message to reply to' },
          { status: 400 }
        );
      }
    } else {
      let content = body.content!.trim();

      // 3.2 Node-level correction: ensure the stored message makes the target explicit
      // so the diagram subagent (which replays conversation) can focus the revision.
      if (body.nodeContext?.label) {
        const prefix = buildNodeCommentPrefix(body.nodeContext.label);
        if (!content.startsWith(prefix)) {
          content = prefix + content;
        }
      }

      await prisma.chatMessage.create({
        data: { processId: id, conversationId, role: 'user', content },
      });
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
        entityType: 'chat',
        entityId: id,
        entityName: process.name,
        summary: `Message in "${process.name}"`,
        metadata: { preview: truncatePreview(content), role: 'user' },
        ...liveOccurredNow(),
      });
      allMessages = [...allMessages, { role: 'user', content }];
    }

    const lastUserContent =
      allMessages.filter((m: { role: string; content: string }) => m.role === 'user').at(-1)?.content ?? '';

    if (
      !replyOnly &&
      shouldExecuteSplit({
        userContent: lastUserContent,
        lastAssistantContent: lastAssistant?.content,
        status: approvedFromChat ? 'forged' : process.status,
      })
    ) {
      const splitResult = await executeProcessSplit(
        { baseUrl: body.baseUrl, apiKey: body.apiKey ?? "", model: body.model },
        id,
        lastUserContent
      );

      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_SPLIT,
        entityType: 'process',
        entityId: id,
        entityName: process.name,
        summary: `Split "${process.name}" into "${splitResult.childName}"`,
        metadata: {
          parentProcessId: splitResult.parentProcessId,
          childProcessId: splitResult.childProcessId,
        },
        ...liveOccurredNow(),
      });
      await recordBusinessEvent({
        businessId: process.businessId,
        userId: result.session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
        entityType: 'process',
        entityId: splitResult.childProcessId,
        entityName: splitResult.childName,
        summary: `Created process "${splitResult.childName}" from split`,
        metadata: { parentProcessId: splitResult.parentProcessId },
        ...liveOccurredNow(),
      });

      const updated = await prisma.process.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          conversations: { orderBy: { createdAt: 'asc' } },
          business: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        process: updated,
        runBackgroundAgents: false,
        split: splitResult,
      });
    }

    const messageCount = allMessages.length;
    const hasDiagram = Boolean(process.diagramMermaid?.trim());
    const recentAccuracyAsk = priorMessages
      .slice(-4)
      .some((m: { role: string; content: string }) => m.role === 'assistant' && assistantAskedAccuracyQuestion(m.content));

    const discovery = pickDiscoveryFields(process);
    const discoveryContext = formatDiscoveryContext(discovery);

    // 4.2 PROCESS.md — business snapshot for contract injection
    const businessSnapshot = await prisma.business.findUnique({
      where: { id: process.businessId },
      select: {
        name: true,
        description: true,
        industry: true,
        goals: true,
        constraints: true,
        processes: {
          select: {
            name: true,
            department: true,
            status: true,
            description: true,
            trigger: true,
            inputs: true,
            outputs: true,
            manualSteps: true,
            ioShape: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
        humanPersonnel: { select: { name: true, role: true } },
        hermesAgentProfiles: {
          where: { isHired: true },
          select: { displayName: true, description: true, isHired: true },
        },
      },
    });
    const processMd = businessSnapshot
      ? buildProcessMdFromBusiness(businessSnapshot)
      : null;

    // 4.10 — full roster for actor-aware chat (roles + hired agents)
    const personnel = await loadPersonnelRoster(process.businessId);

    // 4.18 — pinned / basics knowledge documents
    const knowledgeDocuments = await loadDocumentsForPrompt(process.businessId, prisma);

    const splitAnalysis = analyzeProcessSplit(
      process.diagramMermaid,
      approvedFromChat ? 'forged' : process.status
    );
    const splitAnalysisNote = formatSplitAnalysisForPrompt(splitAnalysis);

    // 3.5 — systems from Questions tab + known tools in process text
    const processSystems = extractSystemsFromFields({
      name: process.name,
      description: process.description,
      trigger: process.trigger,
      inputs: process.inputs,
      outputs: process.outputs,
      manualSteps: process.manualSteps,
    });

    const assistantContent = await callHermes(
      { baseUrl: body.baseUrl, apiKey: body.apiKey ?? "", model: body.model },
      [
        {
          role: 'system',
          content: buildChatSystemPrompt({
            processName: process.name,
            description: process.description,
            nameStatus: process.nameStatus,
            status: approvedFromChat ? 'forged' : process.status,
            hasDiagram,
            discovery,
            processMd,
            knowledgeDocuments,
            personnel,
            systems: processSystems,
            ioShape: process.ioShape,
            splitAnalysisNote: splitAnalysisNote || null,
            shouldAskAccuracy:
              !approvedFromChat &&
              process.status !== 'approved' &&
              process.status !== 'forged' &&
              !recentAccuracyAsk &&
              shouldPromptForAccuracy({
                status: process.status,
                diagramMermaid: process.diagramMermaid,
                messageCount,
              }),
          }),
        },
        {
          role: 'system',
          content: [
            `Current workflow: "${process.name}" — ${process.description || 'Not yet described'}`,
            discoveryContext ?? '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
        ...allMessages,
      ]
    );

    const assistantMessage = assistantContent || 'Thanks — tell me more about the next step.';

    await prisma.chatMessage.create({
      data: { processId: id, conversationId, role: 'assistant', content: assistantMessage },
    });

    if (process.nameStatus === 'pending' && !/^untitled/i.test(process.name)) {
      const renameIntent = /rename|call it|instead|different name|change (the )?name/i.test(lastUserContent);
      if (renameIntent) {
        const match = lastUserContent.match(/(?:call it|rename (?:it )?(?:to )?|name it)\s+["']?([^"'\n.]+)/i);
        if (match?.[1]?.trim()) {
          await prisma.process.update({
            where: { id },
            data: { name: match[1].trim(), nameStatus: 'confirmed' },
          });
        }
      } else {
        await prisma.process.update({
          where: { id },
          data: { nameStatus: 'confirmed' },
        });
      }
    }

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        conversations: { orderBy: { createdAt: 'asc' } },
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      process: updated,
      runBackgroundAgents: true,
      approved: approvedFromChat,
    });
  } catch (error) {
    console.error('Process chat error', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}