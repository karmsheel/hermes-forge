import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { scanHermesProfiles } from '@/lib/personnel/scan-hermes-profiles';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ agents: [], business: null });
    }

    const agents = await prisma.hermesAgentProfile.findMany({
      where: { businessId: business.id },
      orderBy: [{ isHired: 'desc' }, { isDefault: 'desc' }, { displayName: 'asc' }],
    });

    const available = agents.filter((agent) => !agent.isHired);
    const hired = agents.filter((agent) => agent.isHired);

    return NextResponse.json({
      available,
      hired,
      agents,
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    console.error('List agents error', error);
    return NextResponse.json({ error: 'Failed to list agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json(
        { error: 'No active business. Create or select one first.' },
        { status: 400 }
      );
    }

    const scanned = scanHermesProfiles();
    if (scanned.length === 0) {
      return NextResponse.json(
        { error: 'No Hermes profiles found. Install Hermes Agent or set HERMES_HOME.' },
        { status: 404 }
      );
    }

    let added = 0;
    let updated = 0;

    for (const profile of scanned) {
      const existing = await prisma.hermesAgentProfile.findUnique({
        where: {
          businessId_profileKey: {
            businessId: business.id,
            profileKey: profile.profileKey,
          },
        },
      });

      if (existing) {
        await prisma.hermesAgentProfile.update({
          where: { id: existing.id },
          data: {
            displayName: profile.displayName,
            description: profile.description,
            model: profile.model,
            hermesHome: profile.hermesHome,
            isDefault: profile.isDefault,
          },
        });
        updated += 1;
      } else {
        await prisma.hermesAgentProfile.create({
          data: {
            businessId: business.id,
            profileKey: profile.profileKey,
            displayName: profile.displayName,
            description: profile.description,
            model: profile.model,
            hermesHome: profile.hermesHome,
            isDefault: profile.isDefault,
          },
        });
        added += 1;
      }
    }

    const agents = await prisma.hermesAgentProfile.findMany({
      where: { businessId: business.id },
      orderBy: [{ isHired: 'desc' }, { isDefault: 'desc' }, { displayName: 'asc' }],
    });

    const available = agents.filter((agent) => !agent.isHired);
    const hired = agents.filter((agent) => agent.isHired);

    return NextResponse.json({
      available,
      hired,
      agents,
      scan: { found: scanned.length, added, updated },
    });
  } catch (error) {
    console.error('Scan agents error', error);
    return NextResponse.json({ error: 'Failed to scan Hermes profiles' }, { status: 500 });
  }
}