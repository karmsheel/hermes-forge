import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { ensureBusinessDocuments } from "@/lib/documents";
import {
  countForged,
  isThinBusiness,
  toFoundationProcessCard,
  type FoundationOverview,
} from "@/lib/foundation";
import { isProcessForged } from "@/lib/process-status";
import { toProcessLinkDto } from "@/lib/process-links";

/** GET — Foundation room overview for the active business. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      const empty: FoundationOverview = {
        business: null,
        processes: [],
        documents: [],
        links: [],
        stats: {
          processCount: 0,
          documentCount: 0,
          draftCount: 0,
          forgedCount: 0,
          withDiagramCount: 0,
          linkCount: 0,
        },
        isThin: true,
      };
      return NextResponse.json(empty);
    }

    await ensureBusinessDocuments(business.id, prisma);

    const [processes, documents, links, biz] = await Promise.all([
      prisma.process.findMany({
        where: { businessId: business.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          department: true,
          status: true,
          ioShape: true,
          diagramMermaid: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prisma.businessDocument.findMany({
        where: { businessId: business.id },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          kind: true,
          slug: true,
          pinnedForContext: true,
          updatedAt: true,
        },
      }),
      prisma.processLink.findMany({
        where: { businessId: business.id },
        include: {
          fromProcess: { select: { name: true } },
          toProcess: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.business.findUnique({
        where: { id: business.id },
        select: { id: true, name: true, description: true },
      }),
    ]);

    const cards = processes.map(toFoundationProcessCard);
    const forgedCount = countForged(processes);
    const draftCount = processes.filter((p) => !isProcessForged(p.status)).length;
    const withDiagramCount = processes.filter((p) => p.diagramMermaid?.trim()).length;
    const linkDtos = links.map(toProcessLinkDto);

    const overview: FoundationOverview = {
      business: biz
        ? {
            id: biz.id,
            name: biz.name,
            description: biz.description,
          }
        : null,
      processes: cards,
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        slug: d.slug,
        pinnedForContext: d.pinnedForContext,
        updatedAt: d.updatedAt.toISOString(),
      })),
      links: linkDtos,
      stats: {
        processCount: processes.length,
        documentCount: documents.length,
        draftCount,
        forgedCount,
        withDiagramCount,
        linkCount: linkDtos.length,
      },
      isThin: isThinBusiness({
        processCount: processes.length,
        forgedCount,
      }),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Foundation overview error", error);
    return NextResponse.json(
      { error: "Failed to load foundation overview" },
      { status: 500 }
    );
  }
}
