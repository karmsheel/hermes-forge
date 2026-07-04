/** Client helpers for the Electron desktop bridge (`window.forgeDesktop`). */

export function isForgeDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.forgeDesktop?.isDesktop);
}

export async function openVscodeThemeFile(): Promise<string | null> {
  if (!isForgeDesktop() || !window.forgeDesktop?.openVscodeThemeFile) {
    return null;
  }
  return window.forgeDesktop.openVscodeThemeFile();
}