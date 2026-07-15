import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findAutomationByIngestToken,
  ingestContentFromAutomation,
} from "@/lib/content-ingest";
import { CONTENT_CHANNELS, CONTENT_STATUSES } from "@/lib/content-types";

const IngestSchema = z.object({
  title: z.string().trim().min(1).max(300),
  bodyMarkdown: z.string().max(200_000).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  channel: z.enum(CONTENT_CHANNELS).optional().nullable(),
});

function extractBearer(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const headerToken = request.headers.get("x-forge-ingest-token");
  if (headerToken?.trim()) return headerToken.trim();
  return null;
}

/**
 * Token-authenticated content handoff for Hermes cron jobs.
 * Public (no session) — authorized via Automation.ingestToken.
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractBearer(request);
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization: Bearer <ingestToken>" },
        { status: 401 },
      );
    }

    const automation = await findAutomationByIngestToken(token);
    if (!automation?.process) {
      return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });
    }

    if (automation.status === "paused" || automation.status === "failed") {
      return NextResponse.json(
        { error: `Automation is ${automation.status}; content ingest rejected` },
        { status: 409 },
      );
    }

    const body = IngestSchema.parse(await request.json());

    const item = await ingestContentFromAutomation(
      {
        automationId: automation.id,
        processId: automation.process.id,
        businessId: automation.process.businessId,
        processName: automation.process.name,
        ownerUserId: automation.process.business.userId,
        logUserId: null,
      },
      {
        title: body.title,
        bodyMarkdown: body.bodyMarkdown,
        status: body.status,
        channel: body.channel,
        source: "hermes",
      },
    );

    return NextResponse.json({
      ok: true,
      content: {
        id: item.id,
        title: item.title,
        status: item.status,
        channel: item.channel,
        source: item.source,
      },
      reviewUrl: "/content",
    });
  } catch (error) {
    console.error("Content ingest error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to ingest content" }, { status: 500 });
  }
}
