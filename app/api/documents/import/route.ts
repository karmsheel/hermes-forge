import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { liveOccurredNow, recordBusinessEvent, truncatePreview } from "@/lib/business-log";
import { BUSINESS_EVENT_TYPES } from "@/lib/business-log-types";
import { allocateDocumentSlug, ensureBusinessDocuments } from "@/lib/documents";

const ImportSchema = z.object({
  /** Optional display title; derived from filename or first heading if omitted */
  title: z.string().trim().min(1).max(200).optional(),
  /** Original filename for title/slug hints, e.g. market-notes.md */
  filename: z.string().trim().max(260).optional(),
  bodyMarkdown: z.string().min(1).max(200_000),
  pinnedForContext: z.boolean().optional(),
});

function titleFromMarkdown(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() || null;
}

function titleFromFilename(filename?: string): string | null {
  if (!filename) return null;
  const base = filename.replace(/\\/g, "/").split("/").pop() || filename;
  const withoutExt = base.replace(/\.md$/i, "").trim();
  if (!withoutExt) return null;
  return withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

    await ensureBusinessDocuments(business.id, prisma);

    const body = ImportSchema.parse(await request.json());
    const title =
      body.title ||
      titleFromMarkdown(body.bodyMarkdown) ||
      titleFromFilename(body.filename) ||
      "Imported document";

    const slug = await allocateDocumentSlug(business.id, title, prisma);
    const maxOrder = await prisma.businessDocument.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });

    const doc = await prisma.businessDocument.create({
      data: {
        businessId: business.id,
        title,
        kind: "freeform",
        slug,
        bodyMarkdown: body.bodyMarkdown,
        pinnedForContext: body.pinnedForContext ?? false,
        sortOrder: (maxOrder._max.sortOrder ?? 10) + 1,
        source: "import",
      },
    });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.DOCUMENT_CREATED,
      entityType: "document",
      entityId: doc.id,
      entityName: doc.title,
      summary: `Imported document "${doc.title}"`,
      metadata: {
        documentKind: doc.kind,
        documentSlug: doc.slug,
        preview: truncatePreview(body.bodyMarkdown, 120),
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Import document error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to import document" }, { status: 500 });
  }
}
