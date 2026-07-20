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

export async function minimizeWindow(): Promise<void> {
  await window.forgeDesktop?.window?.minimize?.();
}

export async function maximizeToggleWindow(): Promise<boolean | undefined> {
  return window.forgeDesktop?.window?.maximizeToggle?.();
}

export async function closeWindow(): Promise<void> {
  await window.forgeDesktop?.window?.close?.();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!window.forgeDesktop?.window?.isMaximized) return false;
  return Boolean(await window.forgeDesktop.window.isMaximized());
}

/** Subscribe to maximize/restore. Returns unsubscribe, or no-op when not desktop. */
export function onWindowMaximizedChange(
  callback: (maximized: boolean) => void
): () => void {
  return window.forgeDesktop?.window?.onMaximizedChange?.(callback) ?? (() => {});
}
