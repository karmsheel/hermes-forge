import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { normalizeDepartment } from "@/lib/functions";

const CreateFunctionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ functions: [], business: null });
    }

    const functions = await prisma.businessFunction.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      functions,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error("List functions error", error);
    return NextResponse.json({ error: "Failed to list functions" }, { status: 500 });
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

    const body = CreateFunctionSchema.parse(await request.json());
    const name = normalizeDepartment(body.name);
    if (name === "Uncategorized" && !body.name.trim()) {
      return NextResponse.json({ error: "Function name is required" }, { status: 400 });
    }

    const existing = await prisma.businessFunction.findFirst({
      where: {
        businessId: business.id,
        name: { equals: name },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Function “${name}” already exists`, function: existing },
        { status: 409 },
      );
    }

    // Case-insensitive duplicate against process departments still allowed as
    // declared node (ensures empty slots can be reserved). Prefer exact match
    // on normalized name only for the declared table.
    const created = await prisma.businessFunction.create({
      data: {
        businessId: business.id,
        name,
        description: body.description?.trim() || null,
      },
    });

    return NextResponse.json({ function: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    console.error("Create function error", error);
    return NextResponse.json({ error: "Failed to create function" }, { status: 500 });
  }
}
