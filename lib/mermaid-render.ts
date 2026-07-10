import {
  forgeMermaidThemeVariables,
  printMermaidThemeVariables,
} from "@/lib/themes/mermaid-vars";

export interface SvgDimensions {
  width: number;
  height: number;
}

/** UI themes follow the app skin; `print` is fixed high-contrast for PDF/paper. */
export type MermaidAppearance = "dark" | "light" | "print";

export function getSvgDimensions(svg: SVGSVGElement): SvgDimensions {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const rect = svg.getBoundingClientRect();
  const width = parseFloat(svg.getAttribute("width") || "") || rect.width;
  const height = parseFloat(svg.getAttribute("height") || "") || rect.height;
  return { width: width || 400, height: height || 300 };
}

export function getSvgDimensionsFromHtml(svgHtml: string): SvgDimensions {
  if (typeof DOMParser === "undefined") {
    return { width: 400, height: 300 };
  }

  const doc = new DOMParser().parseFromString(svgHtml, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return { width: 400, height: 300 };
  return getSvgDimensions(svg);
}

function resolveAppearance(appearance: MermaidAppearance | boolean): MermaidAppearance {
  if (typeof appearance === "boolean") {
    return appearance ? "dark" : "light";
  }
  return appearance;
}

/** Always re-apply themeVariables so skin switches take effect mid-session. */
async function ensureMermaid(appearance: MermaidAppearance) {
  const mermaid = (await import("mermaid")).default;

  const isPrint = appearance === "print";
  const isDark = appearance === "dark";

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    // `base` + full themeVariables gives the most control for print output
    theme: isPrint ? "base" : isDark ? "dark" : "neutral",
    themeVariables: isPrint
      ? printMermaidThemeVariables()
      : forgeMermaidThemeVariables(isDark),
    // Prefer native SVG text so export can rasterize labels (FO HTML does not paint as <img>)
    flowchart: {
      htmlLabels: false,
      curve: "basis",
      padding: 12,
      nodeSpacing: 40,
      rankSpacing: 50,
    },
    themeCSS: isPrint
      ? `
        text, tspan { fill: #1a1a1a !important; color: #1a1a1a !important; }
        .nodeLabel, .edgeLabel, .label { color: #1a1a1a !important; fill: #1a1a1a !important; }
        .node rect, .node circle, .node ellipse, .node polygon { fill: #ffffff !important; stroke: #333333 !important; }
      `
      : undefined,
  });

  return mermaid;
}

export type MermaidRenderResult =
  | { ok: true; svg: string; width: number; height: number }
  | { ok: false; error: string };

/**
 * Render Mermaid source to SVG HTML.
 * @param appearance - `true`/`"dark"`, `false`/`"light"`, or `"print"` for PDF-friendly colors
 */
export async function renderMermaidSvg(
  source: string,
  renderId: string,
  appearance: MermaidAppearance | boolean,
): Promise<MermaidRenderResult> {
  try {
    const mode = resolveAppearance(appearance);
    const mermaid = await ensureMermaid(mode);
    await mermaid.parse(source);
    const { svg } = await mermaid.render(renderId, source);
    const { width, height } = getSvgDimensionsFromHtml(svg);
    return { ok: true, svg, width, height };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to render diagram",
    };
  }
}
