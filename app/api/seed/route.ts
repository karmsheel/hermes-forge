import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Quick seed for judges / demo purposes
export async function POST() {
  // Clean previous demo business
  await prisma.business.deleteMany({ where: { name: { contains: 'Demo' } } });

  const business = await prisma.business.create({
    data: {
      name: "Forge Labs",
      industry: "Developer Tools",
      description: "SaaS platform that helps indie hackers launch and monetize micro-products.",
      teamSize: 4,
      goals: "Ship 3 major features this quarter and reduce support load by 60%.",
    },
  });

  const demoProcesses = [
    {
      name: "New customer onboarding",
      description: "Manual welcome sequence, Notion setup, Stripe customer creation, and intro call booking",
      department: "Operations",
      trigger: "New paying customer in Stripe",
      manualSteps: "1. Check Stripe 2. Create Notion page 3. Send welcome email 4. Book Calendly",
      inputs: "Stripe webhook + customer email",
      outputs: "Notion page + welcome email + calendar event",
      repetition: 9,
      businessValue: 8,
      complexity: 3,
    },
    {
      name: "Monthly churn survey follow-up",
      description: "When someone cancels, manually send personalized win-back offer",
      department: "Support",
      trigger: "Churn event in Stripe",
      manualSteps: "Look up usage, craft email, send via Gmail, log in CRM",
      inputs: "Cancellation reason + usage data",
      outputs: "Personalized offer email",
      repetition: 6,
      businessValue: 7,
      complexity: 4,
    },
    {
      name: "Content repurposing",
      description: "Turn long-form podcast into Twitter thread + LinkedIn post + newsletter",
      department: "Marketing",
      trigger: "New episode published",
      manualSteps: "Listen, transcribe highlights, rewrite for each channel, schedule",
      repetition: 8,
      businessValue: 6,
      complexity: 6,
    },
  ];

  for (const p of demoProcesses) {
    const score = Math.round((p.repetition! * 0.4 + p.businessValue! * 0.5 - p.complexity! * 0.25) * 6.5);

    await prisma.process.create({
      data: {
        businessId: business.id,
        ...p,
        automationScore: Math.max(35, Math.min(92, score)),
        estimatedTimeSaved: Math.round((p.repetition! + p.businessValue!) / 1.8),
        status: "discovered",
      },
    });
  }

  await prisma.memory.createMany({
    data: [
      { businessId: business.id, fact: "Primary acquisition: Twitter + indie hacker communities", confidence: 0.9 },
      { businessId: business.id, fact: "Biggest time sink: customer onboarding (2.5hrs average)", confidence: 0.85 },
      { businessId: business.id, fact: "Uses Stripe, Notion, Gmail, Calendly, Beehiiv", confidence: 0.95 },
    ],
  });

  return NextResponse.json({ success: true, businessId: business.id });
}
