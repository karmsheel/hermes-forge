import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  deleteHermesSession,
  getHermesSession,
  updateHermesSession,
} from "@/lib/hermes-sessions";

const ConfigSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

const PatchSchema = ConfigSchema.extend({
  title: z.string().nullable().optional(),
  endReason: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const baseUrl = request.nextUrl.searchParams.get("baseUrl");
    const apiKey = request.nextUrl.searchParams.get("apiKey");
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Missing baseUrl or apiKey" },
        { status: 400 },
      );
    }

    const hermesSession = await getHermesSession(baseUrl, apiKey, id);
    return NextResponse.json({ session: hermesSession });
  } catch (error) {
    console.error("Hermes session get error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get session",
      },
      { status: 502 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const body = PatchSchema.parse(await request.json());
    const updated = await updateHermesSession(body.baseUrl, body.apiKey, id, {
      title: body.title,
      endReason: body.endReason,
    });
    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("Hermes session patch error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update session",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    let baseUrl: string | null = null;
    let apiKey: string | null = null;

    // Prefer body credentials; fall back to query (easier for clients).
    try {
      const body = ConfigSchema.partial().parse(await request.json().catch(() => ({})));
      baseUrl = body.baseUrl ?? null;
      apiKey = body.apiKey ?? null;
    } catch {
      /* ignore */
    }
    baseUrl = baseUrl ?? request.nextUrl.searchParams.get("baseUrl");
    apiKey = apiKey ?? request.nextUrl.searchParams.get("apiKey");

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Missing baseUrl or apiKey" },
        { status: 400 },
      );
    }

    const result = await deleteHermesSession(baseUrl, apiKey, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Hermes session delete error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete session",
      },
      { status: 502 },
    );
  }
}
