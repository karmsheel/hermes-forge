import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { createHermesJob, listHermesJobs } from '@/lib/hermes-jobs';

const ConfigSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
});

const CreateSchema = ConfigSchema.extend({
  schedule: z.string().min(1),
  prompt: z.string().min(1),
  name: z.string().min(1),
  deliver: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const baseUrl = request.nextUrl.searchParams.get('baseUrl');
    const apiKey = request.nextUrl.searchParams.get('apiKey');
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Missing baseUrl or apiKey' }, { status: 400 });
    }

    const jobs = await listHermesJobs(baseUrl, apiKey);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Hermes jobs list error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list jobs' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const body = CreateSchema.parse(await request.json());
    const result = await createHermesJob(body.baseUrl, body.apiKey, {
      schedule: body.schedule,
      prompt: body.prompt,
      name: body.name,
      deliver: body.deliver,
    });

    return NextResponse.json({ jobId: result.jobId, raw: result.raw });
  } catch (error) {
    console.error('Hermes job create error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 502 }
    );
  }
}