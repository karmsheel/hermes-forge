import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { forkHermesSession } from "@/lib/hermes-sessions";

const ForkSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
  title: z.string().optional(),
  id: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const body = ForkSchema.parse(await request.json());
    const forked = await forkHermesSession(body.baseUrl, body.apiKey, id, {
      title: body.title,
      id: body.id,
    });
    return NextResponse.json({ session: forked }, { status: 201 });
  } catch (error) {
    console.error("Hermes session fork error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fork session",
      },
      { status: 502 },
    );
  }
}
