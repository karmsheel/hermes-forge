/**
 * Server-side personnel roster load for a business (workshop prompts).
 */

import { prisma } from "@/lib/prisma";
import { buildPersonnelRoster, type PersonnelRoster } from "@/lib/personnel/context";

export async function loadPersonnelRoster(businessId: string): Promise<PersonnelRoster> {
  const [humans, agents] = await Promise.all([
    prisma.humanPersonnel.findMany({
      where: { businessId },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        roleDescription: true,
        isOwner: true,
      },
    }),
    prisma.hermesAgentProfile.findMany({
      where: { businessId, isHired: true },
      orderBy: [{ isDefault: "desc" }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        description: true,
        isHired: true,
      },
    }),
  ]);

  return buildPersonnelRoster({ humans, agents });
}
