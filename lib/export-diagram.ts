/**
 * Client-side diagram export helpers (PNG / PDF).
 * Uses Mermaid → SVG → canvas so exports match the workshop theme.
 *
 * Important: never draw SVG via blob: URLs into a canvas — Chromium taints the
 * canvas and toBlob()/toDataURL() throw. Use a self-contained data: URL instead.
 */

import {
  renderMermaidSvg,
  type MermaidAppearance,
} from "@/lib/mermaid-render";

export function slugifyFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "process";
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function unicodeToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const SVG_NS = "http://www.w3.org/2000/svg";
const PRINT_INK = "#1a1a1a";
const PRINT_INK_MUTED = "#333333";
const PRINT_PAPER = "#ffffff";

type RasterPrepareOptions = {
  /** When true, force white paper + dark ink for print/PDF. */
  print?: boolean;
};

/**
 * Mermaid often puts labels in <foreignObject> (HTML). Those do not paint when
 * the SVG is loaded as an <img>/data URL, so convert them to native SVG <text>.
 */
function convertForeignObjectsToSvgText(
  svg: Element,
  doc: Document,
  ink: string,
): void {
  const fos = Array.from(svg.querySelectorAll("foreignObject"));
  for (const fo of fos) {
    const lines = (fo.textContent || "")
      .split(/\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (lines.length === 0) {
      fo.remove();
      continue;
    }

    const x = parseFloat(fo.getAttribute("x") || "0") || 0;
    const y = parseFloat(fo.getAttribute("y") || "0") || 0;
    const width = parseFloat(fo.getAttribute("width") || "0") || 0;
    const height = parseFloat(fo.getAttribute("height") || "0") || 0;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Estimate font size from FO height / line count (Mermaid boxes vary)
    const fontSize = Math.max(
      11,
      Math.min(16, Math.round((height > 0 ? height / Math.max(lines.length, 1) : 14) * 0.55)),
    );
    const lineHeight = Math.round(fontSize * 1.2);

    const textEl = doc.createElementNS(SVG_NS, "text");
    textEl.setAttribute("x", String(cx));
    textEl.setAttribute("y", String(cy));
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "middle");
    textEl.setAttribute("fill", ink);
    textEl.setAttribute("stroke", "none");
    textEl.setAttribute("font-size", String(fontSize));
    textEl.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', sans-serif");
    textEl.setAttribute("font-weight", "500");

    if (lines.length === 1) {
      textEl.textContent = lines[0];
    } else {
      const startDy = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => {
        const tspan = doc.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(cx));
        tspan.setAttribute("dy", String(i === 0 ? startDy : lineHeight));
        tspan.setAttribute("fill", ink);
        tspan.setAttribute("stroke", "none");
        tspan.textContent = line;
        textEl.appendChild(tspan);
      });
    }

    fo.parentNode?.replaceChild(textEl, fo);
  }
}

/** Force explicit fill on every text node so labels survive class/CSS loss as image. */
function forceInkOnSvgText(svg: Element, ink: string): void {
  svg.querySelectorAll("text, tspan").forEach((el) => {
    el.setAttribute("fill", ink);
    el.setAttribute("stroke", "none");
    const style = el.getAttribute("style");
    if (style) {
      let next = style
        .replace(/fill\s*:\s*[^;]+/gi, `fill: ${ink}`)
        .replace(/color\s*:\s*[^;]+/gi, `color: ${ink}`)
        .replace(/stroke\s*:\s*[^;]+/gi, "stroke: none");
      if (!/fill\s*:/i.test(next)) next = `${next}; fill: ${ink}`;
      el.setAttribute("style", next);
    }
  });
}

/**
 * Inject a print stylesheet that wins over Mermaid's embedded classes.
 * Applied only for PDF / print export.
 */
function injectPrintStyles(svg: Element, doc: Document): void {
  const style = doc.createElementNS(SVG_NS, "style");
  style.textContent = `
    text, tspan {
      fill: ${PRINT_INK} !important;
      color: ${PRINT_INK} !important;
      stroke: none !important;
    }
    .nodeLabel, .edgeLabel, .label, .cluster-label, .labelText, .legend text {
      fill: ${PRINT_INK} !important;
      color: ${PRINT_INK} !important;
    }
    .node rect, .node circle, .node ellipse, .node polygon,
    .node path, .basic.label-container, .label-container,
    .actor, .note, .cluster rect {
      fill: ${PRINT_PAPER} !important;
      stroke: ${PRINT_INK_MUTED} !important;
    }
    .cluster rect {
      fill: #f7f7f7 !important;
    }
    .edgePath path.path, .flowchart-link, path.transition,
    line, polyline, .messageLine0, .messageLine1 {
      stroke: ${PRINT_INK_MUTED} !important;
      fill: none !important;
    }
    marker path, .arrowheadPath, .marker {
      fill: ${PRINT_INK_MUTED} !important;
      stroke: ${PRINT_INK_MUTED} !important;
    }
    .edgeLabel rect, .labelBkg, rect.edgeLabel {
      fill: ${PRINT_PAPER} !important;
      stroke: none !important;
    }
  `;
  svg.insertBefore(style, svg.firstChild);
}

/**
 * Sanitize Mermaid SVG so it can be painted onto a canvas without tainting.
 * Converts HTML labels to SVG text, strips external images, sets size/namespaces.
 */
function prepareSvgForRaster(
  svgHtml: string,
  width: number,
  height: number,
  options: RasterPrepareOptions = {},
): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const print = options.print === true;
  const ink = print ? PRINT_INK : PRINT_INK; // always force readable ink on labels we convert

  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    // Fallback: string surgery only
    let html = svgHtml.trim();
    if (!html.includes('xmlns="http://www.w3.org/2000/svg"')) {
      html = html.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // Cannot convert FO without DOM — strip rather than leave tainting content
    html = html
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/<image\b[^>]*\/?>/gi, "");
    html = html.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
      let a = attrs
        .replace(/\swidth="[^"]*"/i, "")
        .replace(/\sheight="[^"]*"/i, "");
      if (!/\sviewBox=/i.test(a)) {
        a += ` viewBox="0 0 ${w} ${h}"`;
      }
      return `<svg${a} width="${w}" height="${h}">`;
    });
    return html;
  }

  const doc = new DOMParser().parseFromString(svgHtml.trim(), "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG from diagram renderer");
  }

  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    throw new Error("Diagram render did not produce an SVG root");
  }

  // Preserve labels: FO HTML → SVG text (FO does not render in SVG-as-image)
  convertForeignObjectsToSvgText(svg, doc, ink);

  // External images taint the canvas
  svg.querySelectorAll("image").forEach((el) => {
    const href =
      el.getAttribute("href") ||
      el.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      "";
    if (!href.startsWith("data:")) {
      el.remove();
    }
  });

  // Drop styles that pull external fonts/resources (rare but tainting)
  svg.querySelectorAll("style").forEach((styleEl) => {
    const text = styleEl.textContent ?? "";
    if (/@import|url\s*\(\s*['"]?https?:/i.test(text)) {
      styleEl.textContent = text
        .replace(/@import[^;]+;/gi, "")
        .replace(/url\s*\(\s*['"]?https?:[^)]+\)/gi, "none");
    }
  });

  if (print) {
    injectPrintStyles(svg, doc);
  }

  // Always stamp fill on text so labels are visible even if CSS is ignored
  forceInkOnSvgText(svg, ink);

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!svg.getAttribute("xmlns:xlink")) {
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  // Prevent CSS overflow / percentage sizing from collapsing the raster
  const existingStyle = svg.getAttribute("style") ?? "";
  if (!/max-width/i.test(existingStyle)) {
    svg.setAttribute(
      "style",
      `${existingStyle}; max-width: none; width: ${w}px; height: ${h}px`.replace(/^;\s*/, ""),
    );
  }

  return new XMLSerializer().serializeToString(svg);
}

function svgToDataUrl(svgXml: string): string {
  return `data:image/svg+xml;base64,${unicodeToBase64(svgXml)}`;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // data: URLs are same-origin; do not set crossOrigin (can break some browsers)
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load SVG for export"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`Failed to encode ${type}`))),
        type,
        quality,
      );
    } catch (err) {
      // Surface SecurityError (tainted canvas) with a clearer message
      const message =
        err instanceof Error ? err.message : "Canvas export failed";
      reject(
        new Error(
          message.includes("Tainted") || message.includes("tainted")
            ? "Diagram canvas was tainted and cannot be exported. Try again after the diagram finishes rendering."
            : message,
        ),
      );
    }
  });
}

export type RasterResult = {
  canvas: HTMLCanvasElement;
  /** Logical (unscaled) diagram width */
  width: number;
  /** Logical (unscaled) diagram height */
  height: number;
  scale: number;
};

/**
 * Rasterize Mermaid SVG HTML onto an untainted canvas.
 */
export async function rasterizeSvgToCanvas(
  svgHtml: string,
  width: number,
  height: number,
  scale = 2,
  background?: string,
  options: RasterPrepareOptions = {},
): Promise<RasterResult> {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const prepared = prepareSvgForRaster(svgHtml, w, h, options);
  const dataUrl = svgToDataUrl(prepared);
  const img = await loadImageFromUrl(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const bg =
    background ??
    (options.print
      ? PRINT_PAPER
      : typeof window !== "undefined"
        ? getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#1a1917"
        : "#1a1917");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return { canvas, width: w, height: h, scale };
}

const PRINT_BACKGROUND = "#ffffff";

/**
 * Rasterize an SVG string to a PNG blob via canvas.
 */
export async function svgHtmlToPngBlob(
  svgHtml: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const { canvas } = await rasterizeSvgToCanvas(svgHtml, width, height, scale);
  return canvasToBlob(canvas, "image/png");
}

export type DiagramPngResult = {
  blob: Blob;
  width: number;
  height: number;
  filename: string;
};

async function rasterizeMermaid(
  mermaidSource: string,
  appearance: MermaidAppearance | boolean,
  scale = 2,
  background?: string,
): Promise<RasterResult & { svg: string }> {
  const renderId = `export-png-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await renderMermaidSvg(mermaidSource, renderId, appearance);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const isPrint = appearance === "print";
  const raster = await rasterizeSvgToCanvas(
    result.svg,
    result.width,
    result.height,
    scale,
    background ?? (isPrint ? PRINT_BACKGROUND : undefined),
    { print: isPrint },
  );
  return { ...raster, svg: result.svg };
}

/**
 * Render Mermaid source to a downloadable PNG (matches current UI theme).
 */
export async function exportMermaidPng(
  mermaidSource: string,
  processName: string,
  isDark: boolean,
): Promise<DiagramPngResult> {
  const raster = await rasterizeMermaid(mermaidSource, isDark, 2);
  const blob = await canvasToBlob(raster.canvas, "image/png");
  return {
    blob,
    width: raster.width,
    height: raster.height,
    filename: `${slugifyFilename(processName)}-diagram.png`,
  };
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Build a single-page PDF that embeds the diagram as a JPEG (no external deps).
 * Adds a neat padded border frame around the workflow.
 */
export async function canvasToPdfBlob(
  canvas: HTMLCanvasElement,
  opts: { title: string; widthPx: number; heightPx: number },
): Promise<Blob> {
  // Frame: white pad + dark hairline border around the diagram
  const pad = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * 0.03));
  const borderWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004));
  const frameInset = Math.round(borderWidth / 2);

  const jpegCanvas = document.createElement("canvas");
  jpegCanvas.width = canvas.width + pad * 2;
  jpegCanvas.height = canvas.height + pad * 2;
  const ctx = jpegCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  ctx.drawImage(canvas, pad, pad);

  // Outer border around the full framed graphic
  ctx.strokeStyle = PRINT_INK_MUTED;
  ctx.lineWidth = borderWidth;
  ctx.lineJoin = "miter";
  ctx.strokeRect(
    frameInset,
    frameInset,
    jpegCanvas.width - borderWidth,
    jpegCanvas.height - borderWidth,
  );

  const jpegBlob = await canvasToBlob(jpegCanvas, "image/jpeg", 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

  const pageW = 612;
  const pageH = 792;
  const margin = 36;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 28;

  // Use framed JPEG aspect so the border scales cleanly on the page
  const aspect = jpegCanvas.width / Math.max(1, jpegCanvas.height);
  let imgW = maxW;
  let imgH = imgW / aspect;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * aspect;
  }

  const imgX = (pageW - imgW) / 2;
  const imgY = pageH - margin - 24 - imgH;

  return buildPdfWithJpeg({
    title: opts.title,
    jpegBytes,
    jpegW: jpegCanvas.width,
    jpegH: jpegCanvas.height,
    displayW: imgW,
    displayH: imgH,
    imgX,
    imgY,
    pageW,
    pageH,
    margin,
  });
}

/** @deprecated Prefer canvasToPdfBlob from a shared raster; kept for callers with a PNG blob */
export async function pngBlobToPdfBlob(
  pngBlob: Blob,
  opts: { title: string; widthPx: number; heightPx: number },
): Promise<Blob> {
  // Decode PNG via createImageBitmap (same-origin blob → untainted)
  const bitmap = await createImageBitmap(pngBlob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(bitmap, 0, 0);
    return canvasToPdfBlob(canvas, opts);
  } finally {
    bitmap.close();
  }
}

function buildPdfWithJpeg(opts: {
  title: string;
  jpegBytes: Uint8Array;
  jpegW: number;
  jpegH: number;
  displayW: number;
  displayH: number;
  imgX: number;
  imgY: number;
  pageW: number;
  pageH: number;
  margin: number;
}): Blob {
  const titleEsc = escapePdfText(opts.title.slice(0, 80));
  const contentStream = [
    "BT",
    "/F1 14 Tf",
    `50 ${opts.pageH - opts.margin - 14} Td`,
    `(${titleEsc}) Tj`,
    "ET",
    "q",
    `${opts.displayW.toFixed(2)} 0 0 ${opts.displayH.toFixed(2)} ${opts.imgX.toFixed(2)} ${opts.imgY.toFixed(2)} cm`,
    "/Im1 Do",
    "Q",
  ].join("\n");

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const xref: number[] = [];

  function pushBytes(data: Uint8Array) {
    parts.push(data);
    offset += data.length;
  }

  function pushStr(s: string) {
    pushBytes(encoder.encode(s));
  }

  function startObj(id: number) {
    xref[id] = offset;
    pushStr(`${id} 0 obj\n`);
  }

  function endObj() {
    pushStr("\nendobj\n");
  }

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  startObj(1);
  pushStr("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  startObj(2);
  pushStr("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${opts.pageW} ${opts.pageH}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> /Font << /F1 6 0 R >> >> >> >>`,
  );
  endObj();

  startObj(4);
  pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
  endObj();

  startObj(5);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${opts.jpegW} /Height ${opts.jpegH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${opts.jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(opts.jpegBytes);
  pushStr("\nendstream");
  endObj();

  startObj(6);
  pushStr("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  endObj();

  const xrefStart = offset;
  const maxId = 6;
  pushStr(`xref\n0 ${maxId + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (let i = 1; i <= maxId; i++) {
    const off = xref[i] ?? 0;
    pushStr(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

/**
 * Render Mermaid source to a print-ready PDF.
 * Always uses a white background with dark ink (ignores UI dark theme).
 */
export async function exportMermaidPdf(
  mermaidSource: string,
  processName: string,
  _isDark?: boolean,
): Promise<{ blob: Blob; filename: string }> {
  // Force print appearance regardless of app theme / skin
  const raster = await rasterizeMermaid(mermaidSource, "print", 2, PRINT_BACKGROUND);
  const pdfBlob = await canvasToPdfBlob(raster.canvas, {
    title: processName,
    widthPx: raster.width,
    heightPx: raster.height,
  });
  return {
    blob: pdfBlob,
    filename: `${slugifyFilename(processName)}-diagram.pdf`,
  };
}
