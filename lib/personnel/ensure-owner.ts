import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

function ownerDisplayName(user: { name: string | null; email: string } | null): string {
  return user?.name?.trim() || user?.email || 'Owner';
}

export async function ensureBusinessOwner(
  businessId: string,
  userId: string,
  client: DbClient = prisma
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const name = ownerDisplayName(user);

  const existing = await client.humanPersonnel.findFirst({
    where: { businessId, isOwner: true },
  });

  if (existing) {
    if (existing.userId === userId && existing.name !== name) {
      return client.humanPersonnel.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return existing;
  }

  return client.humanPersonnel.create({
    data: {
      businessId,
      userId,
      isOwner: true,
      name,
      role: 'Owner',
      roleDescription: 'Business owner',
    },
  });
}