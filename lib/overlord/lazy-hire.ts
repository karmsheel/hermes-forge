import { prisma } from "@/lib/prisma";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import { getUserOverlord } from "@/lib/overlord/user-overlord";

/**
 * If the business has zero hired agents and the user has an Overlord,
 * ensure a hired HermesAgentProfile row exists for that profileKey.
 * Idempotent. Returns the hired agent row or null if nothing to do.
 */
export async function ensureOverlordHired(businessId: string, userId: string) {
  const hiredCount = await prisma.hermesAgentProfile.count({
    where: { businessId, isHired: true },
  });
  if (hiredCount > 0) {
    return prisma.hermesAgentProfile.findFirst({
      where: { businessId, isHired: true },
      orderBy: [{ isDefault: "desc" }, { displayName: "asc" }],
    });
  }

  const overlord = await getUserOverlord(userId);
  if (!overlord) return null;

  const scanned = scanHermesProfiles().find((p) => p.profileKey === overlord.profileKey);
  const displayName = scanned?.displayName || overlord.displayName;
  const hermesHome = scanned?.hermesHome || overlord.hermesHome;
  const description = scanned?.description ?? null;
  const model = scanned?.model ?? null;
  const isDefault = scanned?.isDefault ?? overlord.profileKey === "default";

  const existing = await prisma.hermesAgentProfile.findUnique({
    where: {
      businessId_profileKey: { businessId, profileKey: overlord.profileKey },
    },
  });

  if (existing) {
    if (existing.isHired) return existing;
    return prisma.hermesAgentProfile.update({
      where: { id: existing.id },
      data: {
        isHired: true,
        hiredAt: new Date(),
        displayName,
        hermesHome,
        description,
        model,
        isDefault,
      },
    });
  }

  return prisma.hermesAgentProfile.create({
    data: {
      businessId,
      profileKey: overlord.profileKey,
      displayName,
      description,
      model,
      hermesHome,
      isDefault,
      isHired: true,
      hiredAt: new Date(),
    },
  });
}
