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

/**
 * High-contrast print palette for PDF / paper export.
 * White page, near-black text and edges — independent of the active UI skin.
 */
export function printMermaidThemeVariables(): Record<string, string | boolean> {
  const ink = "#1a1a1a";
  const inkMuted = "#333333";
  const inkSoft = "#444444";
  const paper = "#ffffff";
  const paperTint = "#f7f7f7";
  const paperAlt = "#eeeeee";
  const border = "#333333";

  return {
    darkMode: false,
    background: paper,
    primaryColor: paper,
    primaryTextColor: ink,
    primaryBorderColor: border,
    secondaryColor: paperTint,
    tertiaryColor: paperAlt,
    lineColor: inkMuted,
    textColor: ink,
    mainBkg: paper,
    nodeBkg: paper,
    nodeBorder: border,
    nodeTextColor: ink,
    clusterBkg: paperTint,
    clusterBorder: inkSoft,
    titleColor: ink,
    edgeLabelBackground: paper,
    actorBkg: paper,
    actorBorder: border,
    actorTextColor: ink,
    actorLineColor: inkMuted,
    labelBoxBkgColor: paper,
    labelBoxBorderColor: border,
    labelTextColor: ink,
    loopTextColor: ink,
    noteBkgColor: paperTint,
    noteTextColor: ink,
    noteBorderColor: border,
    sectionBkgColor: paperTint,
    altSectionBkgColor: paper,
    sectionBkgColor2: paperAlt,
    taskBkgColor: paper,
    taskBorderColor: border,
    taskTextColor: ink,
    taskTextLightColor: ink,
    taskTextOutsideColor: ink,
    taskTextClickableColor: ink,
    activeTaskBkgColor: paperTint,
    activeTaskBorderColor: ink,
    gridColor: "#cccccc",
    doneTaskBkgColor: paperAlt,
    doneTaskBorderColor: inkSoft,
    critBkgColor: paper,
    critBorderColor: ink,
    todayLineColor: inkMuted,
    personBorder: border,
    personBkg: paperTint,
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  };
}