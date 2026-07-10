import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getActiveBusinessForUser, requireSession } from '@/lib/auth';
import { liveOccurredNow, recordBusinessEvent } from '@/lib/business-log';
import { BUSINESS_EVENT_TYPES, type FieldChange } from '@/lib/business-log-types';
import { isPersonnelIconKey } from '@/lib/personnel/icon-catalog';

const PatchHumanSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    role: z.string().trim().min(1).max(200).optional(),
    /** Pass null or "" to clear; omit to leave unchanged. */
    roleDescription: z.string().trim().max(2000).nullable().optional(),
    iconKey: z.string().trim().nullable().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.role !== undefined ||
      body.roleDescription !== undefined ||
      body.iconKey !== undefined,
    { message: 'At least one field is required' }
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const { id } = await params;
    const body = PatchHumanSchema.parse(await request.json());

    if (body.iconKey !== undefined && body.iconKey !== null && !isPersonnelIconKey(body.iconKey)) {
      return NextResponse.json({ error: 'Invalid icon key' }, { status: 400 });
    }

    const human = await prisma.humanPersonnel.findFirst({
      where: { id, businessId: business.id },
    });

    if (!human) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (human.isOwner) {
      if (body.iconKey !== undefined) {
        return NextResponse.json({ error: 'Owner icon cannot be changed' }, { status: 403 });
      }
      if (body.name !== undefined && body.name !== human.name) {
        return NextResponse.json(
          { error: 'Owner name is synced from your profile and cannot be edited here' },
          { status: 403 }
        );
      }
    }

    const nextRoleDescription =
      body.roleDescription === undefined
        ? undefined
        : body.roleDescription === null || body.roleDescription === ''
          ? null
          : body.roleDescription;

    const data: {
      name?: string;
      role?: string;
      roleDescription?: string | null;
      iconKey?: string | null;
    } = {};

    if (body.name !== undefined && !human.isOwner) {
      data.name = body.name;
    }
    if (body.role !== undefined) {
      data.role = body.role;
    }
    if (nextRoleDescription !== undefined) {
      data.roleDescription = nextRoleDescription;
    }
    if (body.iconKey !== undefined && !human.isOwner) {
      data.iconKey = body.iconKey;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(human);
    }

    const updated = await prisma.humanPersonnel.update({
      where: { id: human.id },
      data,
    });

    const identityChanged =
      (data.name !== undefined && data.name !== human.name) ||
      (data.role !== undefined && data.role !== human.role) ||
      (data.roleDescription !== undefined && data.roleDescription !== human.roleDescription);

    if (identityChanged) {
      const changes: FieldChange[] = [];
      if (data.name !== undefined && data.name !== human.name) {
        changes.push({ field: 'name', before: human.name, after: data.name });
      }
      if (data.role !== undefined && data.role !== human.role) {
        changes.push({ field: 'role', before: human.role, after: data.role });
      }
      if (
        data.roleDescription !== undefined &&
        data.roleDescription !== human.roleDescription
      ) {
        changes.push({
          field: 'roleDescription',
          before: human.roleDescription,
          after: data.roleDescription,
        });
      }

      await recordBusinessEvent({
        businessId: business.id,
        userId: session.userId,
        type: BUSINESS_EVENT_TYPES.PERSONNEL_UPDATED,
        entityType: 'personnel',
        entityId: human.id,
        entityName: updated.name,
        summary: `Updated "${updated.name}" (${updated.role})`,
        metadata: {
          kind: 'human',
          role: updated.role,
          changes,
        },
        ...liveOccurredNow(),
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Patch human error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;

    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    const { id } = await params;

    const human = await prisma.humanPersonnel.findFirst({
      where: { id, businessId: business.id },
    });

    if (!human) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (human.isOwner) {
      return NextResponse.json(
        { error: 'The business owner cannot be removed' },
        { status: 403 }
      );
    }

    await prisma.humanPersonnel.delete({ where: { id: human.id } });

    await recordBusinessEvent({
      businessId: business.id,
      userId: session.userId,
      type: BUSINESS_EVENT_TYPES.PERSONNEL_FIRED,
      entityType: 'personnel',
      entityId: human.id,
      entityName: human.name,
      summary: `Fired "${human.name}" from ${business.name} [FIRE]`,
      metadata: {
        kind: 'human',
        role: human.role,
        businessName: business.name,
      },
      ...liveOccurredNow(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete human error', error);
    return NextResponse.json({ error: 'Failed to remove person' }, { status: 500 });
  }
}
