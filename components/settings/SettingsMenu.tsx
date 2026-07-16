"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Monitor, Moon, Palette, Settings, Sun, Trash2 } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { SegmentedControl } from "@/components/ui";
import { useTheme } from "@/components/theme/ThemeProvider";
import { filterSkinsForPreference, resolveSkinPalette } from "@/lib/themes/presets";
import type { ThemePreference } from "@/lib/theme";

const THEME_OPTIONS = [
  { value: "system" as ThemePreference, label: "System", icon: <Monitor className="w-3.5 h-3.5 shrink-0" /> },
  { value: "light" as ThemePreference, label: "Light", icon: <Sun className="w-3.5 h-3.5 shrink-0" /> },
  { value: "dark" as ThemePreference, label: "Dark", icon: <Moon className="w-3.5 h-3.5 shrink-0" /> },
];

const POPOVER_WIDTH = 16.5 * 16; // 16.5rem in px (approx; layout uses rem via CSS width)

interface SettingsMenuProps {
  className?: string;
  /**
   * Popover placement relative to the trigger.
   * - bottom-end: below trigger, right edges aligned (top-bar style)
   * - right-end: right of trigger, bottom edges aligned (nav-rail footer)
   */
  placement?: "bottom-end" | "right-end";
}

export function SettingsMenu({ className, placement = "bottom-end" }: SettingsMenuProps) {
  const { openSettings } = useShell();
  const {
    preference,
    setPreference,
    resolved,
    skinName,
    setSkin,
    availableSkins,
    userSkinNames,
    removeSkin,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { builtinSkins, installedSkins } = useMemo(() => {
    const modeSkins = filterSkinsForPreference(availableSkins, preference);
    const installed: typeof modeSkins = [];
    const builtin: typeof modeSkins = [];
    for (const skin of modeSkins) {
      if (userSkinNames.has(skin.name)) installed.push(skin);
      else builtin.push(skin);
    }
    return { builtinSkins: builtin, installedSkins: installed };
  }, [availableSkins, preference, userSkinNames]);

  const skinHint =
    preference === "system"
      ? "Follows system appearance · day & night palettes"
      : `${resolved === "dark" ? "Night" : "Day"} palette · Hermes Desktop themes`;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_WIDTH, vw - 16);

    if (placement === "right-end") {
      let left = rect.right + gap;
      if (left + width > vw - 8) {
        // Flip to the left of the trigger if not enough room on the right
        left = Math.max(8, rect.left - width - gap);
      }
      // Anchor bottom of popover to bottom of trigger; clamp so it stays on-screen
      const bottom = Math.max(8, vh - rect.bottom);
      setMenuStyle({
        position: "fixed",
        left,
        bottom,
        top: "auto",
        width,
        maxHeight: Math.max(160, vh - bottom - 8),
      });
      return;
    }

    // bottom-end: below trigger, prefer right-aligned
    let top = rect.bottom + gap;
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
    // If not enough room below, flip above
    const estimatedMax = Math.min(420, vh - 16);
    if (top + 200 > vh && rect.top > vh - rect.bottom) {
      top = Math.max(8, rect.top - gap - estimatedMax);
    }
    setMenuStyle({
      position: "fixed",
      top,
      left,
      bottom: "auto",
      width,
      maxHeight: Math.max(160, vh - top - 8),
    });
  }, [placement]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onLayoutChange() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, updateMenuPosition]);

  function renderSkinOption(skin: (typeof availableSkins)[number], removable: boolean) {
    const active = skinName === skin.name;
    const palette = resolveSkinPalette(skin, resolved);

    return (
      <div key={skin.name} className="settings-menu__skin-option-wrap">
        <button
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={skin.label}
          title={`${skin.label} — ${skin.description}`}
          className={`settings-menu__skin-option${active ? " is-active" : ""}`}
          onClick={() => setSkin(skin.name)}
        >
          <span
            className="settings-menu__skin-swatch"
            style={
              {
                "--skin-bg": palette.background,
                "--skin-primary": palette.primary,
              } as CSSProperties
            }
          />
          <span className="settings-menu__skin-label">{skin.label}</span>
        </button>
        {removable && (
          <button
            type="button"
            className="settings-menu__skin-remove"
            aria-label={`Remove ${skin.label} theme`}
            title={`Remove ${skin.label}`}
            onClick={() => removeSkin(skin.name)}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  const popover =
    open && mounted ? (
      <div
        ref={menuRef}
        className="settings-menu__popover settings-menu__popover--portal"
        role="menu"
        aria-label="Settings"
        style={menuStyle}
      >
        <section className="settings-menu__section">
          <div className="settings-menu__section-title">
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </div>
          <SegmentedControl
            value={preference}
            options={THEME_OPTIONS}
            ariaLabel="Color mode"
            onChange={setPreference}
          />
        </section>

        <section className="settings-menu__section">
          <div className="settings-menu__section-title">
            <Palette className="w-3.5 h-3.5" />
            <span>Skin</span>
          </div>
          <p className="settings-menu__skin-hint">{skinHint}</p>
          <div className="settings-menu__skin-grid" role="group" aria-label="Built-in skins">
            {builtinSkins.map((skin) => renderSkinOption(skin, false))}
          </div>

          {installedSkins.length > 0 && (
            <>
              <p className="settings-menu__skin-hint settings-menu__skin-hint--spaced">
                Installed themes
              </p>
              <div className="settings-menu__skin-grid" role="group" aria-label="Installed skins">
                {installedSkins.map((skin) => renderSkinOption(skin, true))}
              </div>
            </>
          )}
        </section>

        <footer className="settings-menu__footer">
          <button
            type="button"
            className="settings-menu__all-settings"
            onClick={() => {
              openSettings("appearance");
              setOpen(false);
            }}
          >
            <span>All settings</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
          </button>
        </footer>
      </div>
    ) : null;

  return (
    <div className={`settings-menu ${className ?? ""}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="settings-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open settings"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Settings"
      >
        <Settings className="w-[17px] h-[17px]" />
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
