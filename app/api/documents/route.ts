import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import {
  allocateDocumentSlug,
  DOCUMENT_KINDS,
  ensureBusinessDocuments,
  isDocumentKind,
} from "@/lib/documents";

const CreateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(DOCUMENT_KINDS).optional(),
  bodyMarkdown: z.string().max(200_000).optional(),
  pinnedForContext: z.boolean().optional(),
  source: z.enum(["manual", "import", "hermes"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ documents: [], business: null });
    }

    await ensureBusinessDocuments(business.id, prisma);

    const documents = await prisma.businessDocument.findMany({
      where: { businessId: business.id },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        kind: true,
        slug: true,
        pinnedForContext: true,
        sortOrder: true,
        source: true,
        updatedAt: true,
        createdAt: true,
        // omit full body on list for lighter payload
        bodyMarkdown: true,
      },
    });

    return NextResponse.json({
      documents,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List documents error", error);
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: "No active business. Create or select one first." },
        { status: 400 },
      );
    }

    const body = CreateDocumentSchema.parse(await request.json());
    const kind = body.kind && isDocumentKind(body.kind) ? body.kind : "freeform";
    const slug = await allocateDocumentSlug(
      business.id,
      body.title,
      prisma,
    );

    // Place freeform notes after seeds
    const maxOrder = await prisma.businessDocument.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? 10) + 1;

    const doc = await prisma.businessDocument.create({
      data: {
        businessId: business.id,
        title: body.title,
        kind,
        slug,
        bodyMarkdown: body.bodyMarkdown ?? "",
        pinnedForContext: body.pinnedForContext ?? false,
        sortOrder,
        source: body.source ?? "manual",
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.DOCUMENT_CREATED,
      entityType: "document",
      entityId: doc.id,
      entityName: doc.title,
      summary: `Created document "${doc.title}"`,
      metadata: {
        documentKind: doc.kind,
        documentSlug: doc.slug,
        pinnedForContext: doc.pinnedForContext,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Create document error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
