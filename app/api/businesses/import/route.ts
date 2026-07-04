import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, setActiveBusinessCookie } from '@/lib/auth';
import { recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES } from '@/lib/business-log-types';
import { ensureBusinessOwner } from '@/lib/personnel/ensure-owner';

const ImportMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string().optional(),
});

const ImportProcessSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(''),
  department: z.string().default('Operations'),
  trigger: z.string().nullable().optional(),
  inputs: z.string().nullable().optional(),
  outputs: z.string().nullable().optional(),
  manualSteps: z.string().nullable().optional(),
  diagramMermaid: z.string().nullable().optional(),
  messages: z.array(ImportMessageSchema).default([]),
});

const ImportPayloadSchema = z.object({
  version: z.literal(1),
  business: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(5000).nullable().optional(),
    industry: z.string().max(100).nullable().optional(),
  }),
  processes: z.array(ImportProcessSchema).default([]),
  memories: z
    .array(
      z.object({
        fact: z.string(),
        confidence: z.number().optional(),
        source: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const data = ImportPayloadSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          userId: session.userId,
          name: data.business.name,
          description: data.business.description ?? null,
          industry: data.business.industry ?? null,
        },
      });

      await ensureBusinessOwner(createdBusiness.id, session.userId, tx);

      for (const p of data.processes) {
        const proc = await tx.process.create({
          data: {
            businessId: createdBusiness.id,
            name: p.name,
            description: p.description,
            department: p.department,
            trigger: p.trigger ?? null,
            inputs: p.inputs ?? null,
            outputs: p.outputs ?? null,
            manualSteps: p.manualSteps ?? null,
            diagramMermaid: p.diagramMermaid ?? null,
            diagramUpdatedAt: p.diagramMermaid ? new Date() : null,
            status: 'discovered',
          },
        });

        if (p.messages.length > 0) {
          await tx.chatMessage.createMany({
            data: p.messages.map((m) => ({
              processId: proc.id,
              role: m.role,
              content: m.content,
              // createdAt defaults to now; we keep original only if useful, but DB is fine with new
            })),
          });
        }
      }

      if (data.memories && data.memories.length > 0) {
        await tx.memory.createMany({
          data: data.memories.map((m) => ({
            businessId: createdBusiness.id,
            fact: m.fact,
            confidence: m.confidence ?? 0.8,
            source: m.source ?? 'import',
          })),
        });
      }

      return createdBusiness;
    });

    await recordBusinessEvent({
      businessId: result.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.BUSINESS_IMPORTED,
      entityType: 'business',
      entityId: result.id,
      entityName: result.name,
      summary: `Imported business "${result.name}"`,
      metadata: {
        count: data.processes?.length ?? 0,
      },
    });

    const response = NextResponse.json({ business: result });
    // Do not auto-activate on import — let user choose
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid import payload' }, { status: 400 });
    }
    console.error('Business import error', error);
    return NextResponse.json({ error: 'Failed to import business' }, { status: 500 });
  }
}
