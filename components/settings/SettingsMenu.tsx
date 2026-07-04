"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Monitor, Moon, Palette, Settings, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { resolveSkinPalette } from "@/lib/themes/presets";
import type { ThemePreference } from "@/lib/theme";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

interface SettingsMenuProps {
  className?: string;
}

export function SettingsMenu({ className }: SettingsMenuProps) {
  const { preference, setPreference, resolved, skinName, setSkin, availableSkins } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

      {open && (
        <div className="settings-menu__popover" role="menu" aria-label="Settings">
          <section className="settings-menu__section">
            <div className="settings-menu__section-title">
              <Palette className="w-3.5 h-3.5" />
              <span>Appearance</span>
            </div>
            <div className="settings-menu__theme-row">
              {THEME_OPTIONS.map((option) => {
                const active = preference === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={`settings-menu__theme-option${active ? " is-active" : ""}`}
                    onClick={() => {
                      setPreference(option.value);
                      setOpen(false);
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-menu__section">
            <div className="settings-menu__section-title">
              <Palette className="w-3.5 h-3.5" />
              <span>Skin</span>
            </div>
            <p className="settings-menu__accent-hint">
              {resolved === "dark" ? "Night palette" : "Day palette"} · Hermes Desktop themes
            </p>
            <div className="settings-menu__skin-grid" role="group" aria-label="Theme skin">
              {availableSkins.map((skin) => {
                const active = skinName === skin.name;
                const palette = resolveSkinPalette(skin, resolved);
                return (
                  <button
                    key={skin.name}
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
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}