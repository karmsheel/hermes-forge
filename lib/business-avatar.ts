import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Factory,
  Globe2,
  Hammer,
  Landmark,
  Lightbulb,
  Megaphone,
  Palette,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Store,
  Truck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

export const BUSINESS_ICON_KEYS = [
  "building2",
  "briefcase",
  "factory",
  "store",
  "landmark",
  "globe2",
  "rocket",
  "sparkles",
  "star",
  "zap",
  "lightbulb",
  "palette",
  "megaphone",
  "users",
  "shield",
  "wrench",
  "hammer",
  "truck",
] as const;

export type BusinessIconKey = (typeof BUSINESS_ICON_KEYS)[number];

const ICON_MAP: Record<BusinessIconKey, LucideIcon> = {
  building2: Building2,
  briefcase: Briefcase,
  factory: Factory,
  store: Store,
  landmark: Landmark,
  globe2: Globe2,
  rocket: Rocket,
  sparkles: Sparkles,
  star: Star,
  zap: Zap,
  lightbulb: Lightbulb,
  palette: Palette,
  megaphone: Megaphone,
  users: Users,
  shield: Shield,
  wrench: Wrench,
  hammer: Hammer,
  truck: Truck,
};

export const BUSINESS_EMOJI_OPTIONS = [
  "🏢",
  "🏭",
  "🏪",
  "🏬",
  "🏗️",
  "💼",
  "📊",
  "📈",
  "🚀",
  "✨",
  "💡",
  "🔥",
  "⚡",
  "🎯",
  "🛠️",
  "🧰",
  "🤝",
  "💎",
  "🌟",
  "🌿",
  "🌊",
  "🎨",
  "🧪",
  "📦",
] as const;

export function isBusinessIconKey(value: string): value is BusinessIconKey {
  return (BUSINESS_ICON_KEYS as readonly string[]).includes(value);
}

export function resolveBusinessIcon(iconKey: string | null | undefined): LucideIcon | null {
  if (iconKey && isBusinessIconKey(iconKey)) return ICON_MAP[iconKey];
  return null;
}

/** First letter of each whitespace-separated word (e.g. "Hermes Forge" → "HF"). */
export function businessInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const initials = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const ch = word.match(/[\p{L}\p{N}]/u)?.[0];
      return ch ? ch.toUpperCase() : "";
    })
    .join("");
  return initials || "?";
}

export type BusinessAvatarDisplay =
  | { kind: "emoji"; value: string }
  | { kind: "icon"; value: BusinessIconKey }
  | { kind: "initial"; value: string };

export function resolveBusinessAvatar(
  name: string,
  avatarEmoji: string | null | undefined,
  avatarIcon: string | null | undefined,
): BusinessAvatarDisplay {
  const emoji = avatarEmoji?.trim();
  if (emoji) return { kind: "emoji", value: emoji };

  const icon = resolveBusinessIcon(avatarIcon);
  if (icon && avatarIcon && isBusinessIconKey(avatarIcon)) {
    return { kind: "icon", value: avatarIcon };
  }

  return { kind: "initial", value: businessInitial(name) };
}