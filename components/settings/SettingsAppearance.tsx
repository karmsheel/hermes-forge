"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { ListRow, SegmentedControl } from "@/components/ui";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  CHATBAR_EDGE_ALIGNS,
  CHATBAR_PREFS_CHANGED_EVENT,
  CHATBAR_SIDES,
  DEFAULT_CHATBAR_EDGE_ALIGN,
  DEFAULT_CHATBAR_SIDE,
  loadChatbarEdgeAlign,
  loadChatbarSide,
  notifyChatbarPrefsChanged,
  offsetForEdgeAlign,
  saveChatbarEdgeAlign,
  saveChatbarEdgeOffset,
  saveChatbarSide,
  type ChatbarEdgeAlign,
  type ChatbarSide,
} from "@/lib/chatbar/residency";
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

const SIDE_OPTIONS: { value: ChatbarSide; label: string }[] = [
  { value: CHATBAR_SIDES.LEFT, label: "Left" },
  { value: CHATBAR_SIDES.RIGHT, label: "Right" },
];

type EdgeAlignPreset = Exclude<ChatbarEdgeAlign, "custom">;

const EDGE_ALIGN_OPTIONS: { value: EdgeAlignPreset; label: string }[] = [
  { value: CHATBAR_EDGE_ALIGNS.TOP, label: "Top" },
  { value: CHATBAR_EDGE_ALIGNS.MIDDLE, label: "Middle" },
  { value: CHATBAR_EDGE_ALIGNS.BOTTOM, label: "Bottom" },
];

export function SettingsAppearance() {
  const { preference, setPreference } = useTheme();
  const { isSavingLocale } = useLocale();
  const [chatSide, setChatSide] = useState<ChatbarSide>(DEFAULT_CHATBAR_SIDE);
  const [edgeAlign, setEdgeAlign] = useState<EdgeAlignPreset>(
    DEFAULT_CHATBAR_EDGE_ALIGN === CHATBAR_EDGE_ALIGNS.CUSTOM
      ? CHATBAR_EDGE_ALIGNS.MIDDLE
      : (DEFAULT_CHATBAR_EDGE_ALIGN as EdgeAlignPreset),
  );

  const hydrateChatPrefs = useCallback(() => {
    setChatSide(loadChatbarSide());
    const loaded = loadChatbarEdgeAlign();
    setEdgeAlign(
      loaded === CHATBAR_EDGE_ALIGNS.TOP || loaded === CHATBAR_EDGE_ALIGNS.BOTTOM
        ? loaded
        : CHATBAR_EDGE_ALIGNS.MIDDLE,
    );
  }, []);

  useEffect(() => {
    hydrateChatPrefs();
    function onPrefs() {
      hydrateChatPrefs();
    }
    window.addEventListener(CHATBAR_PREFS_CHANGED_EVENT, onPrefs);
    return () => window.removeEventListener(CHATBAR_PREFS_CHANGED_EVENT, onPrefs);
  }, [hydrateChatPrefs]);

  const onSideChange = useCallback((next: ChatbarSide) => {
    setChatSide(next);
    saveChatbarSide(next);
    notifyChatbarPrefsChanged();
  }, []);

  const onEdgeAlignChange = useCallback((next: EdgeAlignPreset) => {
    setEdgeAlign(next);
    saveChatbarEdgeAlign(next);
    saveChatbarEdgeOffset(offsetForEdgeAlign(next));
    notifyChatbarPrefsChanged();
  }, []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
          <Palette className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Appearance</h2>
          <p className="text-xs text-text-soft">Language, color mode, themes, and chat tab</p>
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

          <div className="py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">Collapsed chat tab</div>
                <p className="mt-1 text-xs text-text-muted max-w-md">
                  Where the Hermes mark sits when chat is hidden. Drag the tab along the edge for a
                  custom spot (snaps near top/middle/bottom), or right-click for presets.
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0">
                <SegmentedControl
                  value={chatSide}
                  options={SIDE_OPTIONS}
                  ariaLabel="Chat dock side"
                  onChange={onSideChange}
                />
                <SegmentedControl
                  value={edgeAlign}
                  options={EDGE_ALIGN_OPTIONS}
                  ariaLabel="Chat tab vertical position"
                  onChange={onEdgeAlignChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}