"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Monitor, Moon, Palette, Plus, Settings, Sun, Trash2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { resolveSkinPalette } from "@/lib/themes/presets";
import type { ThemePreference } from "@/lib/theme";
import { SkinInstallDialog } from "./SkinInstallDialog";

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
  const [installOpen, setInstallOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { builtinSkins, installedSkins } = useMemo(() => {
    const installed: typeof availableSkins = [];
    const builtin: typeof availableSkins = [];
    for (const skin of availableSkins) {
      if (userSkinNames.has(skin.name)) installed.push(skin);
      else builtin.push(skin);
    }
    return { builtinSkins: builtin, installedSkins: installed };
  }, [availableSkins, userSkinNames]);

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

  return (
    <>
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
              <div className="settings-menu__skin-grid" role="group" aria-label="Built-in skins">
                {builtinSkins.map((skin) => renderSkinOption(skin, false))}
              </div>

              {installedSkins.length > 0 && (
                <>
                  <p className="settings-menu__accent-hint settings-menu__accent-hint--spaced">
                    Installed themes
                  </p>
                  <div className="settings-menu__skin-grid" role="group" aria-label="Installed skins">
                    {installedSkins.map((skin) => renderSkinOption(skin, true))}
                  </div>
                </>
              )}

              <button
                type="button"
                className="settings-menu__install-skin"
                onClick={() => {
                  setInstallOpen(true);
                  setOpen(false);
                }}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Install custom theme…</span>
              </button>
            </section>
          </div>
        )}
      </div>

      <SkinInstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  );
}