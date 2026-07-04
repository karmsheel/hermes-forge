import { installUserTheme } from "./user-themes";
import { parseThemeInput } from "./validate";
import { convertVscodeColorTheme, parseVscodeTheme } from "./vscode";
import type { ForgeSkin } from "./types";

export type ThemePreviewResult =
  | { ok: true; theme: ForgeSkin; source: "forge" | "vscode" }
  | { ok: false; error: string };

export function previewThemeFromText(text: string): ThemePreviewResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a theme JSON object to install." };
  }

  const forgeResult = parseThemeInput(trimmed);
  if (forgeResult.ok) {
    return { ok: true, theme: forgeResult.theme, source: "forge" };
  }

  try {
    const raw = parseVscodeTheme(trimmed);
    const { theme } = convertVscodeColorTheme(raw);
    return { ok: true, theme, source: "vscode" };
  } catch (vscodeError) {
    const vscodeMsg =
      vscodeError instanceof Error ? vscodeError.message : "Invalid VS Code theme.";
    return { ok: false, error: `${forgeResult.error} — or as VS Code theme: ${vscodeMsg}` };
  }
}

/** Parse Forge JSON or VS Code color theme and install as a user skin. */
export function installThemeFromText(text: string): ForgeSkin {
  const preview = previewThemeFromText(text);
  if (!preview.ok) {
    throw new Error(preview.error);
  }
  return installUserTheme(preview.theme);
}