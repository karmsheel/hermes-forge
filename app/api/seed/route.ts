import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession, setActiveBusinessCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    await prisma.business.deleteMany({
      where: { userId: session.userId, name: 'Forge Labs' },
    });

    const business = await prisma.business.create({
      data: {
        userId: session.userId,
        name: 'Forge Labs',
        industry: 'Developer Tools',
        description: 'SaaS platform that helps indie hackers launch and monetize micro-products.',
        teamSize: 4,
        goals: 'Ship 3 major features this quarter and reduce support load by 60%.',
      },
    });

    const demoProcesses = [
      {
        name: 'New customer onboarding',
        description: 'Manual welcome sequence, Notion setup, Stripe customer creation, and intro call booking',
        department: 'Operations',
        trigger: 'New paying customer in Stripe',
        manualSteps: '1. Check Stripe 2. Create Notion page 3. Send welcome email 4. Book Calendly',
        inputs: 'Stripe webhook + customer email',
        outputs: 'Notion page + welcome email + calendar event',
        repetition: 9,
        businessValue: 8,
        complexity: 3,
      },
      {
        name: 'Monthly churn survey follow-up',
        description: 'When someone cancels, manually send personalized win-back offer',
        department: 'Support',
        trigger: 'Churn event in Stripe',
        manualSteps: 'Look up usage, craft email, send via Gmail, log in CRM',
        inputs: 'Cancellation reason + usage data',
        outputs: 'Personalized offer email',
        repetition: 6,
        businessValue: 7,
        complexity: 4,
      },
      {
        name: 'Content repurposing',
        description: 'Turn long-form podcast into Twitter thread + LinkedIn post + newsletter',
        department: 'Marketing',
        trigger: 'New episode published',
        manualSteps: 'Listen, transcribe highlights, rewrite for each channel, schedule',
        repetition: 8,
        businessValue: 6,
        complexity: 6,
      },
    ];

    const demoDiagrams: Record<string, string> = {
      'New customer onboarding': `flowchart TD
  trigger([Stripe payment received]) --> check[Review customer details]
  check --> notion[Create Notion workspace]
  notion --> email[Send welcome email]
  email --> cal[Book intro call via Calendly]
  cal --> done([Onboarding complete])`,
      'Monthly churn survey follow-up': `flowchart TD
  trigger([Cancellation in Stripe]) --> lookup[Look up usage history]
  lookup --> craft[Craft personalized offer]
  craft --> send[Send via Gmail]
  send --> log[Log in CRM]
  log --> done([Follow-up complete])`,
      'Content repurposing': `flowchart TD
  trigger([Episode published]) --> listen[Review episode highlights]
  listen --> twitter[Draft Twitter thread]
  listen --> linkedin[Draft LinkedIn post]
  listen --> newsletter[Draft newsletter section]
  twitter --> schedule[Schedule posts]
  linkedin --> schedule
  newsletter --> schedule
  schedule --> done([Content live])`,
    };

    for (const p of demoProcesses) {
      const score = Math.round((p.repetition! * 0.4 + p.businessValue! * 0.5 - p.complexity! * 0.25) * 6.5);

      await prisma.process.create({
        data: {
          businessId: business.id,
          ...p,
          automationScore: Math.max(35, Math.min(92, score)),
          estimatedTimeSaved: Math.round((p.repetition! + p.businessValue!) / 1.8),
          status: 'discovered',
          diagramMermaid: demoDiagrams[p.name] ?? null,
          diagramUpdatedAt: demoDiagrams[p.name] ? new Date() : null,
        },
      });
    }

    await prisma.memory.createMany({
      data: [
        { businessId: business.id, fact: 'Primary acquisition: Twitter + indie hacker communities', confidence: 0.9 },
        { businessId: business.id, fact: 'Biggest time sink: customer onboarding (2.5hrs average)', confidence: 0.85 },
        { businessId: business.id, fact: 'Uses Stripe, Notion, Gmail, Calendly, Beehiiv', confidence: 0.95 },
      ],
    });

    const response = NextResponse.json({ success: true, businessId: business.id });
    setActiveBusinessCookie(response, business.id);
    return response;
  } catch (error) {
    console.error('Seed error', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}