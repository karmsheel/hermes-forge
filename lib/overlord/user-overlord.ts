import { prisma } from "@/lib/prisma";
import type { ForgeOverlordSummary, ScannedOverlordCandidate } from "@/lib/overlord/types";

export function isOverlordSet(user: {
  forgeOverlordProfileKey?: string | null;
}): boolean {
  return Boolean(user.forgeOverlordProfileKey?.trim());
}

export function toOverlordSummary(user: {
  forgeOverlordProfileKey?: string | null;
  forgeOverlordDisplayName?: string | null;
  forgeOverlordHermesHome?: string | null;
  forgeOverlordSetAt?: Date | null;
}): ForgeOverlordSummary | null {
  const key = user.forgeOverlordProfileKey?.trim();
  if (!key) return null;
  return {
    profileKey: key,
    displayName: user.forgeOverlordDisplayName?.trim() || key,
    hermesHome: user.forgeOverlordHermesHome?.trim() || "",
    setAt: user.forgeOverlordSetAt ? user.forgeOverlordSetAt.toISOString() : null,
  };
}

export async function getUserOverlord(userId: string): Promise<ForgeOverlordSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      forgeOverlordProfileKey: true,
      forgeOverlordDisplayName: true,
      forgeOverlordHermesHome: true,
      forgeOverlordSetAt: true,
    },
  });
  if (!user) return null;
  return toOverlordSummary(user);
}

export async function setUserOverlord(
  userId: string,
  candidate: ScannedOverlordCandidate,
): Promise<ForgeOverlordSummary> {
  const setAt = new Date();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      forgeOverlordProfileKey: candidate.profileKey,
      forgeOverlordDisplayName: candidate.displayName,
      forgeOverlordHermesHome: candidate.hermesHome,
      forgeOverlordSetAt: setAt,
    },
    select: {
      forgeOverlordProfileKey: true,
      forgeOverlordDisplayName: true,
      forgeOverlordHermesHome: true,
      forgeOverlordSetAt: true,
    },
  });
  const summary = toOverlordSummary(user);
  if (!summary) throw new Error("Failed to set Overlord");
  return summary;
}
