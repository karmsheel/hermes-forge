"use client";

import { resolvePersonnelIcon } from "@/lib/personnel/icon-catalog";

interface PersonnelIconProps {
  iconKey?: string | null;
  kind: "human" | "agent";
  isOwner?: boolean;
  className?: string;
}

export function PersonnelIcon({
  iconKey,
  kind,
  isOwner = false,
  className = "w-7 h-7",
}: PersonnelIconProps) {
  const Icon = resolvePersonnelIcon(iconKey, kind, isOwner);
  return <Icon className={`text-accent ${className}`} aria-hidden />;
}