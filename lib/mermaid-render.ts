import { forgeMermaidThemeVariables } from "@/lib/themes/mermaid-vars";

export interface SvgDimensions {
  width: number;
  height: number;
}

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

let mermaidInitialized = false;
let mermaidThemeKey = "";

async function ensureMermaid(isDark: boolean) {
  const themeKey = isDark ? "dark" : "light";
  const mermaid = (await import("mermaid")).default;

  if (!mermaidInitialized || mermaidThemeKey !== themeKey) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: isDark ? "dark" : "neutral",
      themeVariables: forgeMermaidThemeVariables(isDark),
      flowchart: {
        htmlLabels: false,
        curve: "basis",
        padding: 12,
        nodeSpacing: 40,
        rankSpacing: 50,
      },
    });
    mermaidInitialized = true;
    mermaidThemeKey = themeKey;
  }

  return mermaid;
}

export type MermaidRenderResult =
  | { ok: true; svg: string; width: number; height: number }
  | { ok: false; error: string };

export async function renderMermaidSvg(
  source: string,
  renderId: string,
  isDark: boolean,
): Promise<MermaidRenderResult> {
  try {
    const mermaid = await ensureMermaid(isDark);
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