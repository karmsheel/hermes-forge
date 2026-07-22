import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { chatHermesSession } from "@/lib/hermes-sessions";

const ChatSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
  message: z.string().min(1),
  systemMessage: z.string().optional(),
  sessionKey: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const { id } = await context.params;
    const body = ChatSchema.parse(await request.json());
    const result = await chatHermesSession(body.baseUrl, body.apiKey, id, {
      message: body.message,
      systemMessage: body.systemMessage,
      sessionKey: body.sessionKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Hermes session chat error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to chat on session",
      },
      { status: 502 },
    );
  }
}
