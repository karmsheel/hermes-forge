"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { ListRow, SegmentedControl } from "@/components/ui";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SkinPicker } from "./SkinPicker";

const THEME_OPTIONS = [
  {
    value: "system" as ThemePreference,
    label: "System",
    icon: <Monitor className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    value: "light" as ThemePreference,
    label: "Light",
    icon: <Sun className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    value: "dark" as ThemePreference,
    label: "Dark",
    icon: <Moon className="w-3.5 h-3.5 shrink-0" />,
  },
];

export function SettingsAppearance() {
  const { preference, setPreference } = useTheme();
  const { isSavingLocale } = useLocale();

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
          <Palette className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Appearance</h2>
          <p className="text-xs text-text-soft">Language, color mode, and themes</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="divide-y divide-border-soft">
          <div className="py-1">
            <ListRow
              label="Language"
              description={
                isSavingLocale
                  ? "Saving language preference…"
                  : "Choose the display language for Hermes Forge."
              }
              action={<LanguageSwitcher />}
            />
          </div>

          <div className="py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">Theme</div>
                <p className="mt-1 text-xs text-text-muted max-w-md">
                  Pick a built-in skin or install a custom theme. System shows themes with both day
                  and night palettes; Light and Dark show only matching skins.
                </p>
              </div>
              <SegmentedControl
                value={preference}
                options={THEME_OPTIONS}
                ariaLabel="Color mode"
                onChange={setPreference}
                className="shrink-0"
              />
            </div>
            <div className="mt-4">
              <SkinPicker />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}