import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { seedFoundationDrafts, type SeedMode } from "@/lib/foundation-seed";

const DraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  ioShape: z.string().max(16).optional().nullable(),
  trigger: z.string().max(2000).optional().nullable(),
  inputs: z.string().max(5000).optional().nullable(),
  outputs: z.string().max(5000).optional().nullable(),
});

const BodySchema = z.object({
  drafts: z.array(DraftSchema).min(1).max(40),
  /** When true (default), skip if same name exists. Prefer mode for new callers. */
  skipDuplicates: z.boolean().optional().default(true),
  /** skip = no-op on name match; upsert = update non-forged matches (6.3). */
  mode: z.enum(["skip", "upsert"]).optional(),
});

/**
 * POST — seed one or more draft processes for the Foundation room.
 * Idempotent by name when mode=skip (default).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: "No active business. Create or select one first." },
        { status: 400 }
      );
    }

    const body = BodySchema.parse(await request.json());
    const mode: SeedMode =
      body.mode ?? (body.skipDuplicates === false ? "upsert" : "skip");

    const result = await seedFoundationDrafts({
      businessId: business.id,
      userId: session.userId,
      drafts: body.drafts,
      mode,
    });

    if (
      result.createdCount === 0 &&
      result.updatedCount === 0 &&
      result.skippedCount === 0
    ) {
      return NextResponse.json({ error: "No valid drafts" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid draft payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Foundation seed-drafts error", error);
    return NextResponse.json(
      { error: "Failed to seed foundation drafts" },
      { status: 500 }
    );
  }
}
