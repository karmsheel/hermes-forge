import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getActiveBusinessForUser,
  requireSession,
  setActiveBusinessCookie,
} from "@/lib/auth";
import { deriveBusinessName } from "@/lib/home-prompt";
import { formatStandardTag } from "@/lib/process-standards";
import { categorizeWorkflow } from "@/lib/categorize-workflow";
import {
  liveOccurredNow,
  markBusinessLogInitialized,
  recordBusinessEvent,
  truncatePreview,
} from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { ensureBusinessOwner } from "@/lib/personnel/ensure-owner";
import { ensureBusinessDocuments } from "@/lib/documents";
import { deriveIoShape } from "@/lib/io-shape";
import { seedFoundationDrafts } from "@/lib/foundation-seed";
import {
  getWorkflowTemplate,
  isWorkflowTemplateId,
  templateToFoundationDrafts,
} from "@/lib/workflow-templates";

const StartFromBriefSchema = z.object({
  brief: z.string().min(1).max(5000),
  templateId: z
    .string()
    .optional()
    .refine((v) => v === undefined || isWorkflowTemplateId(v), {
      message: "Unknown workflow template",
    }),
  processName: z.string().max(120).optional(),
  diagramMermaid: z.string().max(20000).optional(),
  processStandard: z
    .enum(["auto", "bpmn-lite", "swimlane", "flowchart"])
    .optional(),
});

type BriefBusiness = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Home / entry: create business if needed, seed a **Foundation draft**,
 * attach the user brief for optional Workshop deep-link (pending Hermes reply).
 * Phase 6.7 — templates and freeform both land as drafts, not workshop-first mapping.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = StartFromBriefSchema.parse(await request.json());
    const trimmed = body.brief.trim();
    const templateId =
      body.templateId && isWorkflowTemplateId(body.templateId)
        ? body.templateId
        : undefined;
    const template = templateId ? getWorkflowTemplate(templateId) : undefined;
    const templateTag = templateId ? `[template:${templateId}] ` : "";
    const standardTag = formatStandardTag(body.processStandard ?? "auto");
    const diagramMermaid =
      body.diagramMermaid?.trim() ||
      template?.diagramMermaid?.trim() ||
      null;

    const existingBusiness = await getActiveBusinessForUser(
      session.userId,
      request
    );

    let business: BriefBusiness;
    let createdBusiness = false;

    if (existingBusiness) {
      business = {
        id: existingBusiness.id,
        name: existingBusiness.name,
        description: existingBusiness.description,
        createdAt: existingBusiness.createdAt,
        updatedAt: existingBusiness.updatedAt,
      };
    } else {
      const created = await prisma.business.create({
        data: {
          userId: session.userId,
          name: deriveBusinessName(trimmed),
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
      business = created;
      createdBusiness = true;
      await ensureBusinessOwner(business.id, session.userId, prisma);
      await ensureBusinessDocuments(business.id, prisma);
    }

    if (createdBusiness) {
      await recordBusinessEvent({
        businessId: business.id,
        userId: session.userId,
        type: BUSINESS_EVENT_TYPES.BUSINESS_CREATED,
        entityType: "business",
        entityId: business.id,
        entityName: business.name,
        summary: `Created business "${business.name}"`,
        ...liveOccurredNow(),
      });
      await markBusinessLogInitialized(business.id);
    }

    const processName =
      body.processName?.trim() ||
      template?.processName?.trim() ||
      "New workflow";

    let processId: string;
    let processNameOut = processName;

    if (template) {
      // 6.7 — template → Foundation draft(s), optional starter diagram
      const drafts = templateToFoundationDrafts(template).map((d) => ({
        ...d,
        name: body.processName?.trim() || d.name,
        diagramMermaid: diagramMermaid ?? d.diagramMermaid,
        description: `${templateTag}${standardTag}${d.description || trimmed}`,
      }));

      const seed = await seedFoundationDrafts({
        businessId: business.id,
        userId: session.userId,
        drafts,
        mode: "skip",
      });

      const primary =
        seed.created[0] ??
        (await findProcessByName(business.id, drafts[0]?.name || processName));

      if (!primary) {
        return NextResponse.json(
          { error: "Failed to seed foundation draft from template" },
          { status: 500 }
        );
      }

      processId = primary.id;
      processNameOut = primary.name;
    } else {
      // Freeform brief → single Foundation draft
      const ioShape = deriveIoShape({ diagramMermaid });
      const created = await prisma.process.create({
        data: {
          businessId: business.id,
          name: processName,
          description: `${standardTag}${trimmed}`,
          department: categorizeWorkflow(`${processName} ${trimmed}`),
          status: "draft",
          nameStatus: "confirmed",
          diagramMermaid,
          diagramUpdatedAt: diagramMermaid ? new Date() : null,
          ioShape,
          conversations: {
            create: {
              title: "Main",
              businessId: business.id,
              kind: "process",
            },
          },
        },
        select: {
          id: true,
          name: true,
          conversations: { select: { id: true }, take: 1 },
        },
      });

      const conversationId = created.conversations[0]?.id;
      if (conversationId) {
        await prisma.chatMessage.create({
          data: {
            processId: created.id,
            conversationId,
            role: "assistant",
            content:
              "This is a **Foundation draft** — a lightweight block for the plant sketch. Open Workshop to refine it into a full process map with Hermes.",
          },
        });
      }

      await recordBusinessEvent({
        businessId: business.id,
        userId: session.userId,
        type: BUSINESS_EVENT_TYPES.PROCESS_CREATED,
        entityType: "process",
        entityId: created.id,
        entityName: created.name,
        summary: `Seeded foundation draft "${created.name}"`,
        metadata: { preview: "foundation_seed:brief" },
        ...liveOccurredNow(),
      });

      processId = created.id;
      processNameOut = created.name;
    }

    // Attach user brief for Workshop deep-link / pending Hermes reply
    await appendUserBriefMessage({
      processId,
      businessId: business.id,
      brief: trimmed,
      processName: processNameOut,
      userId: session.userId,
    });

    const process = await prisma.process.findUnique({
      where: { id: processId },
      select: {
        id: true,
        name: true,
        description: true,
        diagramMermaid: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response = NextResponse.json({
      businessId: business.id,
      processId,
      business,
      process,
      foundationDraft: true,
    });
    setActiveBusinessCookie(response, business.id);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Start from brief error", error);
    return NextResponse.json(
      { error: "Failed to start from brief" },
      { status: 500 }
    );
  }
}

async function findProcessByName(businessId: string, name: string) {
  return prisma.process.findFirst({
    where: {
      businessId,
      name: name.trim(),
    },
    select: { id: true, name: true },
  });
}

async function appendUserBriefMessage(opts: {
  processId: string;
  businessId: string;
  brief: string;
  processName: string;
  userId: string;
}) {
  const conv = await prisma.conversation.findFirst({
    where: { processId: opts.processId, kind: "process" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!conv) return;

  await prisma.chatMessage.create({
    data: {
      processId: opts.processId,
      conversationId: conv.id,
      role: "user",
      content: opts.brief,
    },
  });

  await recordBusinessEvent({
    businessId: opts.businessId,
    userId: opts.userId,
    type: BUSINESS_EVENT_TYPES.CHAT_USER_MESSAGE,
    entityType: "chat",
    entityId: opts.processId,
    entityName: opts.processName,
    summary: `Message in "${opts.processName}"`,
    metadata: { preview: truncatePreview(opts.brief), role: "user" },
    ...liveOccurredNow(),
  });
}
