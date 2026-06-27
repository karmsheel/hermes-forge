import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const business = await prisma.business.create({
      data: {
        name: body.name || 'Untitled Business',
        industry: body.industry || null,
        description: body.description || null,
        teamSize: body.teamSize || null,
        website: body.website || null,
        goals: body.goals || null,
        constraints: body.constraints || null,
      },
    });

    return NextResponse.json(business);
  } catch (error) {
    console.error('Create business error', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const business = await prisma.business.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { 
        processes: { orderBy: { automationScore: 'desc' } }, 
        memories: { orderBy: { lastUpdated: 'desc' }, take: 12 } 
      },
    });
    return NextResponse.json(business || null);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
