"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { skinSupportsBothModes } from "@/lib/themes/presets";

export function NavThemeModeToggle() {
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
      className="nav-rail__item"
      onClick={handleToggle}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}