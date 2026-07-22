import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  createHermesSession,
  listHermesSessions,
} from "@/lib/hermes-sessions";

const ConfigSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

const CreateSchema = ConfigSchema.extend({
  title: z.string().optional(),
  model: z.string().optional(),
  id: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const baseUrl = request.nextUrl.searchParams.get("baseUrl");
    const apiKey = request.nextUrl.searchParams.get("apiKey");
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Missing baseUrl or apiKey" },
        { status: 400 },
      );
    }

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const offsetRaw = request.nextUrl.searchParams.get("offset");
    const source = request.nextUrl.searchParams.get("source");
    const includeChildren =
      request.nextUrl.searchParams.get("include_children") === "true" ||
      request.nextUrl.searchParams.get("includeChildren") === "true";

    const result = await listHermesSessions(baseUrl, apiKey, {
      limit: limitRaw ? Number(limitRaw) : undefined,
      offset: offsetRaw ? Number(offsetRaw) : undefined,
      source,
      includeChildren,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Hermes sessions list error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list sessions",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = CreateSchema.parse(await request.json());
    const created = await createHermesSession(body.baseUrl, body.apiKey, {
      title: body.title,
      model: body.model,
      id: body.id,
      systemPrompt: body.systemPrompt,
    });

    return NextResponse.json({ session: created }, { status: 201 });
  } catch (error) {
    console.error("Hermes session create error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 502 },
    );
  }
}
