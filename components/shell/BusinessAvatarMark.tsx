"use client";

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { businessInitial, resolveBusinessAvatar, resolveBusinessIcon } from "@/lib/business-avatar";

interface BusinessAvatarMarkProps {
  name: string;
  avatarEmoji?: string | null;
  avatarIcon?: string | null;
  className?: string;
  emptyFallback?: ReactNode;
}

export function BusinessAvatarMark({
  name,
  avatarEmoji,
  avatarIcon,
  className = "business-switcher__avatar",
  emptyFallback = <Building2 className="w-3.5 h-3.5" />,
}: BusinessAvatarMarkProps) {
  if (!name.trim()) {
    return (
      <span className={className} aria-hidden>
        {emptyFallback}
      </span>
    );
  }

  const avatar = resolveBusinessAvatar(name, avatarEmoji, avatarIcon);

  if (avatar.kind === "emoji") {
    return (
      <span className={`${className} business-avatar-mark business-avatar-mark--emoji`} aria-hidden>
        {avatar.value}
      </span>
    );
  }

  if (avatar.kind === "icon") {
    const Icon = resolveBusinessIcon(avatar.value);
    if (Icon) {
      return (
        <span className={`${className} business-avatar-mark business-avatar-mark--icon`} aria-hidden>
          <Icon className="w-3.5 h-3.5" />
        </span>
      );
    }
  }

  return (
    <span className={className} aria-hidden>
      {businessInitial(name)}
    </span>
  );
}