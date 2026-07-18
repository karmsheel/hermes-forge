import { prisma } from "@/lib/prisma";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import { getUserOverlord } from "@/lib/overlord/user-overlord";

/**
 * Ensure a hired HermesAgentProfile row exists for the user's Forge Overlord
 * on this business. Idempotent. Returns the hired Overlord row, or null if
 * no Overlord is set.
 *
 * Unlike the earlier "hire only when zero agents" behavior, this always
 * hires the Overlord so it remains available next to other hired agents.
 */
export async function ensureOverlordHired(businessId: string, userId: string) {
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
    if (existing.isHired) {
      // Keep display metadata in sync with the user Overlord snapshot when useful.
      if (
        existing.displayName !== displayName ||
        existing.hermesHome !== hermesHome
      ) {
        return prisma.hermesAgentProfile.update({
          where: { id: existing.id },
          data: {
            displayName,
            hermesHome,
            description,
            model,
            isDefault,
          },
        });
      }
      return existing;
    }
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
