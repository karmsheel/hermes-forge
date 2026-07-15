import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrCreateAutomation,
  requireApprovedProcessAccess,
} from "@/lib/automation-access";
import { ingestContentFromAutomation } from "@/lib/content-ingest";
import { CONTENT_CHANNELS, CONTENT_STATUSES } from "@/lib/content-types";

const SimulateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  bodyMarkdown: z.string().max(200_000).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  channel: z.enum(CONTENT_CHANNELS).optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Session-authenticated "agent draft" handoff for testing without Hermes HTTP tools.
 * Creates ContentItem linked to the process automation (status defaults to review).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await requireApprovedProcessAccess(request, id);
    if ("error" in result) return result.error;

    const process = result.process;
    const automation = await getOrCreateAutomation(id, {
      userId: result.session.userId,
    });

    const body = SimulateSchema.parse(await request.json());

    const item = await ingestContentFromAutomation(
      {
        automationId: automation.id,
        processId: process.id,
        businessId: process.businessId,
        processName: process.name,
        ownerUserId: process.business.userId,
        logUserId: result.session.userId,
      },
      {
        title: body.title,
        bodyMarkdown: body.bodyMarkdown,
        status: body.status ?? "review",
        channel: body.channel,
        source: "hermes",
      },
    );

    return NextResponse.json({
      ok: true,
      content: item,
      reviewUrl: "/content",
    });
  } catch (error) {
    console.error("Simulate content error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }
}
