import type { LucideIcon } from "lucide-react";
import { Code, Info, Palette, ScrollText } from "lucide-react";

export type SettingsViewId = "appearance" | "agent-prompts" | "about" | "developer";

export interface SettingsSection {
  id: SettingsViewId;
  label: string;
  icon: LucideIcon;
  gapBefore?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
  },
  {
    id: "agent-prompts",
    label: "Agent prompts",
    icon: ScrollText,
  },
  {
    id: "about",
    label: "About",
    icon: Info,
    gapBefore: true,
  },
];

const DEVELOPER_SECTION: SettingsSection = {
  id: "developer",
  label: "Developer",
  icon: Code,
  gapBefore: true,
};

export function getSettingsSections(isDeveloperUnlocked: boolean): SettingsSection[] {
  if (!isDeveloperUnlocked) return SETTINGS_SECTIONS;
  return [...SETTINGS_SECTIONS, DEVELOPER_SECTION];
}

export const DEFAULT_SETTINGS_VIEW: SettingsViewId = "appearance";

export function isSettingsViewId(value: string | null | undefined): value is SettingsViewId {
  if (value === "developer") return true;
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function resolveSettingsView(
  value: string | null | undefined,
  isDeveloperUnlocked = false
): SettingsViewId {
  if (value === "developer") {
    return isDeveloperUnlocked ? "developer" : DEFAULT_SETTINGS_VIEW;
  }
  return SETTINGS_SECTIONS.some((section) => section.id === value)
    ? (value as SettingsViewId)
    : DEFAULT_SETTINGS_VIEW;
}