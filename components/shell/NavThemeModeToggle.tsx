"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { skinSupportsBothModes } from "@/lib/themes/presets";

interface NavThemeModeToggleProps {
  className?: string;
}

/** Match settings gear / profile chrome weight (settings uses 17px). */
const ICON_PROPS = {
  className: "theme-mode-toggle__icon",
  size: 17,
  strokeWidth: 1.75,
  absoluteStrokeWidth: false as const,
};

/**
 * Day/night mode toggle for dual-palette skins.
 * Lives in title-bar trailing chrome (multi-tab strip, AppTopBar, Business Manager).
 */
export function NavThemeModeToggle({ className }: NavThemeModeToggleProps) {
  const { skin, resolved, setPreference } = useTheme();

  if (!skinSupportsBothModes(skin)) {
    return null;
  }

  const isDark = resolved === "dark";
  const label = isDark ? "Switch to day mode" : "Switch to night mode";

  function handleToggle() {
    setPreference(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      className={["theme-mode-toggle", className].filter(Boolean).join(" ")}
      onClick={handleToggle}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun {...ICON_PROPS} /> : <Moon {...ICON_PROPS} />}
    </button>
  );
}
