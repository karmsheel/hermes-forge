/**
 * Client-side plant (business PFD) export — PNG / SVG / PDF (Phase 6.6 trail).
 * Builds a self-contained SVG from layout data (no DOM capture), then reuses
 * diagram raster/PDF helpers so exports stay untainted and print-friendly.
 */

import {
  canvasToPdfBlob,
  downloadBlob,
  rasterizeSvgToCanvas,
  slugifyFilename,
} from "@/lib/export-diagram";
import { getIoShapeMeta, normalizeIoShape, type IoShapeId } from "@/lib/io-shape";
import {
  getDeptLabelY,
  orthogonalLinkPoints,
  pointsToPathD,
  type PlantLayoutMode,
  type PlantTilePosition,
} from "@/lib/plant-layout";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@/lib/process-status";

const TITLE_BAND = 48;
const PRINT_BG = "#ffffff";
const PRINT_PANEL = "#f7f7f5";
const PRINT_BORDER = "#c8c4bc";
const PRINT_TEXT = "#1a1a1a";
const PRINT_MUTED = "#555555";
const PRINT_LINK = "#666666";

export type PlantExportBlock = {
  id: string;
  name: string;
  department: string;
  status: string;
  ioShape?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlantExportLink = {
  fromId: string;
  toId: string;
};

/** Outside-the-plant input/outcome chips (already placed in canvas space). */
export type PlantExportBoundaryChip = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  attachX: number;
  attachY: number;
};

export type PlantExportTheme = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  link: string;
};

export type BuildPlantSvgOptions = {
  title: string;
  blocks: PlantExportBlock[];
  links: PlantExportLink[];
  canvasWidth: number;
  canvasHeight: number;
  /** When "function", draw department band labels. */
  layoutMode?: PlantLayoutMode;
  /** print = white paper + dark ink; theme = current UI colors. */
  appearance?: "theme" | "print";
  theme?: Partial<PlantExportTheme>;
  boundaryFeeds?: PlantExportBoundaryChip[];
  boundaryProducts?: PlantExportBoundaryChip[];
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateLabel(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function statusLabel(status: string): string {
  const key = status as ProcessStatus;
  return PROCESS_STATUS_LABELS[key] ?? status;
}

function readThemeFromDom(): PlantExportTheme {
  if (typeof window === "undefined") {
    return {
      bg: "#1a1917",
      panel: "#222120",
      border: "#333128",
      text: "#e8e4dc",
      textMuted: "#9a9690",
      link: "#9a9690",
    };
  }
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg", "#1a1917"),
    panel: v("--bg-panel", "#222120"),
    border: v("--border", "#333128"),
    text: v("--text", "#e8e4dc"),
    textMuted: v("--text-muted", "#9a9690"),
    link: v("--text-muted", "#9a9690"),
  };
}

function resolveTheme(
  appearance: "theme" | "print",
  override?: Partial<PlantExportTheme>,
): PlantExportTheme {
  if (appearance === "print") {
    return {
      bg: PRINT_BG,
      panel: PRINT_PANEL,
      border: PRINT_BORDER,
      text: PRINT_TEXT,
      textMuted: PRINT_MUTED,
      link: PRINT_LINK,
      ...override,
    };
  }
  return { ...readThemeFromDom(), ...override };
}

/** Inline I/O glyph paths (matches IoShapeGlyph viewBox 0 0 40 24). */
function glyphPaths(shape: IoShapeId, stroke: string): string {
  const box = `<rect x="12" y="5" width="16" height="14" rx="2" stroke="${stroke}" stroke-width="1.5" fill="none"/>`;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>`;
  // Both side arrows point rightward (in from left, out to right) — same as IoShapeGlyph.
  const arrowL = (y: number) =>
    `${line(2, y, 11, y)}<polyline points="8,${y - 3} 11,${y} 8,${y + 3}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const arrowR = (y: number) =>
    `${line(29, y, 38, y)}<polyline points="35,${y - 3} 38,${y} 35,${y + 3}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

  switch (shape) {
    case "simo":
      return `${arrowL(12)}${box}${arrowR(7)}${arrowR(17)}`;
    case "miso":
      return `${arrowL(7)}${arrowL(17)}${box}${arrowR(12)}`;
    case "mimo":
      return `${arrowL(7)}${arrowL(17)}${box}${arrowR(7)}${arrowR(17)}`;
    case "siso":
    default:
      return `${arrowL(12)}${box}${arrowR(12)}`;
  }
}

function blockToTile(b: PlantExportBlock): PlantTilePosition {
  return {
    id: b.id,
    department: b.department,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
  };
}

/**
 * Build a self-contained plant SVG (no external CSS/fonts required for labels).
 */
export function buildPlantSvg(options: BuildPlantSvgOptions): string {
  const appearance = options.appearance ?? "theme";
  const theme = resolveTheme(appearance, options.theme);
  const blocks = options.blocks;
  const byId = new Map(blocks.map((b) => [b.id, blockToTile(b)]));
  const w = Math.max(1, Math.round(options.canvasWidth));
  const h = Math.max(1, Math.round(options.canvasHeight + TITLE_BAND));
  const yOffset = TITLE_BAND;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="${theme.bg}"/>`);

  // Title
  parts.push(
    `<text x="24" y="30" fill="${theme.text}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="16" font-weight="600">${escapeXml(options.title)}</text>`,
  );
  parts.push(
    `<text x="24" y="44" fill="${theme.textMuted}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="10">${blocks.length} process${blocks.length === 1 ? "" : "es"}${options.links.length > 0 ? ` · ${options.links.length} link${options.links.length === 1 ? "" : "s"}` : ""} · Hermes Forge plant</text>`,
  );

  // Content group shifted for title band
  parts.push(`<g transform="translate(0,${yOffset})">`);

  // Outside I/O chips + dashed connectors
  const feeds = options.boundaryFeeds ?? [];
  const products = options.boundaryProducts ?? [];
  for (const chip of feeds) {
    parts.push(
      `<line x1="${chip.x + chip.width}" y1="${chip.y + chip.height / 2}" x2="${chip.attachX}" y2="${chip.attachY}" stroke="${theme.textMuted}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    );
  }
  for (const chip of products) {
    parts.push(
      `<line x1="${chip.x}" y1="${chip.y + chip.height / 2}" x2="${chip.attachX}" y2="${chip.attachY}" stroke="${theme.textMuted}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    );
  }
  for (const chip of [...feeds, ...products]) {
    parts.push(
      `<rect x="${chip.x}" y="${chip.y}" width="${chip.width}" height="${chip.height}" rx="6" fill="${theme.panel}" stroke="${theme.border}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${chip.x + chip.width / 2}" y="${chip.y + chip.height / 2 + 3.5}" text-anchor="middle" fill="${theme.textMuted}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="10" font-weight="500">${escapeXml(truncateLabel(chip.label, 18))}</text>`,
    );
  }

  // Department labels (function layout)
  if (options.layoutMode === "function") {
    const depts = [...new Set(blocks.map((b) => b.department || "Uncategorized"))].sort(
      (a, b) => a.localeCompare(b),
    );
    const tileList = blocks.map(blockToTile);
    for (const dept of depts) {
      const y = getDeptLabelY(dept, tileList);
      parts.push(
        `<text x="64" y="${y + 14}" fill="${theme.textMuted}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="11" font-weight="500" letter-spacing="0.08em">${escapeXml(dept.toUpperCase())}</text>`,
      );
    }
  }

  // Links
  parts.push(
    `<defs><marker id="plant-export-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 Z" fill="${theme.link}"/></marker></defs>`,
  );
  for (const link of options.links) {
    const from = byId.get(link.fromId);
    const to = byId.get(link.toId);
    if (!from || !to) continue;
    const d = pointsToPathD(orthogonalLinkPoints(from, to));
    if (!d) continue;
    parts.push(
      `<path d="${d}" fill="none" stroke="${theme.link}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#plant-export-arrow)"/>`,
    );
  }

  // Blocks
  for (const block of blocks) {
    const shape = normalizeIoShape(block.ioShape);
    const meta = getIoShapeMeta(shape);
    const name = truncateLabel(block.name, 26);
    const status = truncateLabel(statusLabel(block.status), 16);
    const cx = block.x + block.width / 2;
    const glyphY = block.y + 28;
    const nameY = block.y + block.height - 52;
    const metaY = block.y + block.height - 32;

    parts.push(`<g data-process-id="${escapeXml(block.id)}">`);
    parts.push(
      `<title>${escapeXml(`${block.name} (${meta.label})`)}</title>`,
    );
    parts.push(
      `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" rx="10" fill="${theme.panel}" stroke="${theme.border}" stroke-width="1.5"/>`,
    );
    // Glyph centered
    parts.push(
      `<g transform="translate(${cx - 30}, ${glyphY}) scale(1.5)">${glyphPaths(shape, theme.text)}</g>`,
    );
    parts.push(
      `<text x="${cx}" y="${nameY}" text-anchor="middle" fill="${theme.text}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="12" font-weight="600">${escapeXml(name)}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="${metaY}" text-anchor="middle" fill="${theme.textMuted}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="10">${escapeXml(status)} · ${escapeXml(shape.toUpperCase())}</text>`,
    );
    parts.push(`</g>`);
  }

  parts.push("</g>");
  parts.push("</svg>");
  return parts.join("");
}

export type PlantExportInput = {
  businessName: string;
  blocks: PlantExportBlock[];
  links: PlantExportLink[];
  canvasWidth: number;
  canvasHeight: number;
  layoutMode?: PlantLayoutMode;
  boundaryFeeds?: PlantExportBoundaryChip[];
  boundaryProducts?: PlantExportBoundaryChip[];
};

function plantTitle(businessName: string): string {
  const name = businessName.trim() || "Business";
  return `${name} — Plant`;
}

export type PlantExportFileResult = {
  blob: Blob;
  filename: string;
};

function toBuildOptions(
  input: PlantExportInput,
  appearance: "theme" | "print",
  title: string,
): BuildPlantSvgOptions {
  return {
    title,
    blocks: input.blocks,
    links: input.links,
    canvasWidth: input.canvasWidth,
    canvasHeight: input.canvasHeight,
    layoutMode: input.layoutMode,
    appearance,
    boundaryFeeds: input.boundaryFeeds,
    boundaryProducts: input.boundaryProducts,
  };
}

/**
 * Export plant as SVG file (vector, theme colors).
 */
export function exportPlantSvg(input: PlantExportInput): PlantExportFileResult {
  if (input.blocks.length === 0) {
    throw new Error("No processes to export");
  }
  const svg = buildPlantSvg(
    toBuildOptions(input, "theme", plantTitle(input.businessName)),
  );
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return {
    blob,
    filename: `${slugifyFilename(input.businessName)}-plant.svg`,
  };
}

/**
 * Export plant as PNG (theme colors, 2× resolution).
 */
export async function exportPlantPng(
  input: PlantExportInput,
): Promise<PlantExportFileResult> {
  if (input.blocks.length === 0) {
    throw new Error("No processes to export");
  }
  const title = plantTitle(input.businessName);
  const svg = buildPlantSvg(toBuildOptions(input, "theme", title));
  const w = Math.max(1, Math.round(input.canvasWidth));
  const h = Math.max(1, Math.round(input.canvasHeight + TITLE_BAND));
  const theme = readThemeFromDom();
  const { canvas } = await rasterizeSvgToCanvas(svg, w, h, 2, theme.bg);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode PNG"))),
      "image/png",
    );
  });
  return {
    blob,
    filename: `${slugifyFilename(input.businessName)}-plant.png`,
  };
}

/**
 * Export plant as print-ready PDF (white background).
 */
export async function exportPlantPdf(
  input: PlantExportInput,
): Promise<PlantExportFileResult> {
  if (input.blocks.length === 0) {
    throw new Error("No processes to export");
  }
  const title = plantTitle(input.businessName);
  const svg = buildPlantSvg(toBuildOptions(input, "print", title));
  const w = Math.max(1, Math.round(input.canvasWidth));
  const h = Math.max(1, Math.round(input.canvasHeight + TITLE_BAND));
  const { canvas } = await rasterizeSvgToCanvas(svg, w, h, 2, PRINT_BG, {
    print: true,
  });
  const pdfBlob = await canvasToPdfBlob(canvas, {
    title,
    widthPx: w,
    heightPx: h,
  });
  return {
    blob: pdfBlob,
    filename: `${slugifyFilename(input.businessName)}-plant.pdf`,
  };
}

export type PlantExportFormat = "png" | "svg" | "pdf";

/** Run export + trigger browser download. */
export async function downloadPlantExport(
  format: PlantExportFormat,
  input: PlantExportInput,
): Promise<void> {
  let result: PlantExportFileResult;
  if (format === "svg") {
    result = exportPlantSvg(input);
  } else if (format === "png") {
    result = await exportPlantPng(input);
  } else {
    result = await exportPlantPdf(input);
  }
  downloadBlob(result.filename, result.blob);
}
