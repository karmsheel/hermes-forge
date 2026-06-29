import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireBusinessAccess, setActiveBusinessCookie } from '@/lib/auth';

const ActiveSchema = z.object({
  businessId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = ActiveSchema.parse(await request.json());
    const session = await requireBusinessAccess(request, body.businessId);
    if (session instanceof NextResponse) return session;

    const response = NextResponse.json({ success: true, businessId: body.businessId });
    setActiveBusinessCookie(response, body.businessId);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Set active business error', error);
    return NextResponse.json({ error: 'Failed to set active business' }, { status: 500 });
  }
}