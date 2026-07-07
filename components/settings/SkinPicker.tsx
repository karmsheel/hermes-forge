"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { filterSkinsForPreference, resolveSkinPalette } from "@/lib/themes/presets";
import { SkinInstallDialog } from "./SkinInstallDialog";
import { ThemeDesignSystemPreview } from "./ThemeDesignSystemPreview";

export function SkinPicker() {
  const {
    preference,
    resolved,
    skinName,
    setSkin,
    availableSkins,
    userSkinNames,
    removeSkin,
  } = useTheme();
  const [installOpen, setInstallOpen] = useState(false);

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
    <div className="settings-appearance__skins">
      <p className="settings-appearance__skin-hint">{skinHint}</p>
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

      <ThemeDesignSystemPreview />

      <button
        type="button"
        className="settings-menu__install-skin"
        onClick={() => setInstallOpen(true)}
      >
        <Plus className="w-3.5 h-3.5 shrink-0" />
        <span>Install custom theme…</span>
      </button>

      <SkinInstallDialog open={installOpen} onClose={() => setInstallOpen(false)} elevated />
    </div>
  );
}