/** Read a resolved CSS custom property from the document root. */
export function readCssVar(
  name: string,
  el: HTMLElement = document.documentElement,
): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Map active Forge skin tokens to Mermaid themeVariables. */
export function forgeMermaidThemeVariables(
  isDark: boolean,
  el: HTMLElement = document.documentElement,
): Record<string, string | boolean> {
  const bg = readCssVar("--bg", el);
  const bgPanel = readCssVar("--bg-panel", el);
  const bgElevated = readCssVar("--bg-elevated", el);
  const bgMuted = readCssVar("--bg-muted", el);
  const bgSubtle = readCssVar("--bg-subtle", el);
  const text = readCssVar("--text", el);
  const textMuted = readCssVar("--text-muted", el);
  const border = readCssVar("--border", el);

  const base = {
    background: bg,
    primaryColor: isDark ? bgPanel : bgElevated || bgPanel,
    primaryTextColor: text,
    primaryBorderColor: border,
    lineColor: textMuted,
    secondaryColor: bgMuted,
    tertiaryColor: bgSubtle,
    fontFamily: "system-ui, sans-serif",
  };

  return isDark ? { ...base, darkMode: true } : base;
}