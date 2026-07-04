import { forgeVarsFromSkin } from "./apply-skin";
import { BUILTIN_SKIN_LIST, DEFAULT_SKIN_NAME } from "./presets";
import { SKIN_STORAGE_KEY } from "./storage";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Inline boot script: applies theme mode + skin CSS vars before first paint. */
export function getThemeBootScript(): string {
  const bootSkins: Record<string, { light: Record<string, string>; dark: Record<string, string> }> =
    {};

  for (const skin of BUILTIN_SKIN_LIST) {
    bootSkins[skin.name] = {
      light: forgeVarsFromSkin(skin, "light"),
      dark: forgeVarsFromSkin(skin, "dark"),
    };
  }

  const payload = JSON.stringify({
    themeKey: THEME_STORAGE_KEY,
    skinKey: SKIN_STORAGE_KEY,
    defaultSkin: DEFAULT_SKIN_NAME,
    skins: bootSkins,
    accentKey: "hermes-forge-accent",
    accentMap: {
      terracotta: "forge",
      coral: "ember",
      amber: "ember",
      sage: "slate",
      ocean: "nous",
      plum: "midnight",
      rose: "midnight",
      slate: "slate",
    },
    migrationKey: "hermes-forge-skin-migrated-v1",
  });

  return `(function(){try{var p=${payload};var root=document.documentElement;function resolveMode(pref){if(pref==='light')return'light';if(pref==='dark')return'dark';return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}function applyVars(vars){for(var k in vars){if(Object.prototype.hasOwnProperty.call(vars,k)){root.style.setProperty(k,vars[k]);}}}var pref=localStorage.getItem(p.themeKey);if(pref==='light'||pref==='dark'){root.setAttribute('data-theme',pref);}else if(pref==='system'){root.removeAttribute('data-theme');}else{root.setAttribute('data-theme','dark');}var mode=resolveMode(pref||'dark');var skin=localStorage.getItem(p.skinKey);if(!skin||!p.skins[skin]){if(!localStorage.getItem(p.migrationKey)){var legacy=localStorage.getItem(p.accentKey);if(legacy&&p.accentMap[legacy]){skin=p.accentMap[legacy];}else{skin=p.defaultSkin;}localStorage.setItem(p.skinKey,skin);localStorage.setItem(p.migrationKey,'1');localStorage.removeItem(p.accentKey);}else{skin=p.defaultSkin;}}var pack=p.skins[skin]||p.skins[p.defaultSkin];applyVars(pack[mode]);root.setAttribute('data-skin',skin);}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-skin',${JSON.stringify(DEFAULT_SKIN_NAME)});}})();`;
}