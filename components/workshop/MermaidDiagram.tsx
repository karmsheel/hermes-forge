"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { serializeNodeCommentSummary } from "@/lib/node-comment";
import { Loader2, GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { forgeMermaidThemeVariables, readCssVar } from "@/lib/themes/mermaid-vars";
import { sanitizeMermaidSource } from "@/lib/mermaid-sanitize";
import { NodeCommentDot } from "./DiagramComments";

interface MermaidDiagramProps {
  chart: string | null;
  className?: string;
  isStreaming?: boolean;
  onNodeClick?: (node: { id: string; label: string }) => void;
  selectedNodeLabel?: string | null;
  /** Called when user clicks the diagram background (not a node) to deselect (3.2) */
  onDeselect?: () => void;
  /** Full selected node (used for precise highlight even with duplicate labels) */
  selectedNode?: MermaidNodeInfo | null;
  /**
   * Emitted whenever the diagram is (re-)rendered, with the list of nodes
   * MermaidDiagram discovered. Used by the parent to surface diagram steps
   * as @-mention candidates in the rich composer (3.5).
   */
  onNodesChange?: (nodes: MermaidNodeInfo[]) => void;
  /**
   * 3.2: per-node user comment summary. Keys are node labels (matched
   * case-insensitively against rendered nodes). Dots are rendered over
   * matching nodes; clicking a dot fires `onNodeCommentClick(label)`.
   */
  commentedNodes?: ReadonlyMap<string, { count: number; firstLabel: string }>;
  /** Called when the user clicks a node comment dot. */
  onNodeCommentClick?: (label: string) => void;
  }

export type MermaidNodeInfo = { id: string; label: string };

type CommentDot = { x: number; y: number; count: number; label: string };

function commentDotsEqual(a: ReadonlyArray<CommentDot>, b: ReadonlyArray<CommentDot>): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (dot, index) =>
      dot.x === b[index].x &&
      dot.y === b[index].y &&
      dot.count === b[index].count &&
      dot.label === b[index].label,
  );
}

function measureCommentDots(
  viewport: HTMLElement,
  svg: SVGSVGElement,
  commentedNodes: ReadonlyMap<string, { count: number; firstLabel: string }>,
): CommentDot[] {
  const nodeEls = Array.from(svg.querySelectorAll<SVGGElement>("g.node, g.cluster"));
  const fallback = nodeEls.length
    ? nodeEls
    : (Array.from(svg.querySelectorAll<SVGGElement>("g")).filter(
        (g) =>
          g.querySelector("rect, circle, ellipse, polygon") && g.querySelector("text"),
      ) as SVGGElement[]);

  const labelToEls = new Map<string, SVGGElement[]>();
  for (const el of fallback) {
    const label = extractNodeLabel(el);
    if (!label) continue;
    const key = label.trim().toLowerCase();
    const list = labelToEls.get(key) ?? [];
    list.push(el);
    labelToEls.set(key, list);
  }

  const viewportRect = viewport.getBoundingClientRect();
  const next: CommentDot[] = [];
  for (const [key, summary] of Array.from(commentedNodes.entries())) {
    const els = labelToEls.get(key);
    if (!els || els.length === 0) continue;
    const el = els[0];
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const x = r.right - viewportRect.left - 4;
    const y = r.top - viewportRect.top + 4;
    next.push({ x, y, count: summary.count, label: summary.firstLabel });
  }
  return next;
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const VIEWPORT_PADDING = 40;
const DEFAULT_ZOOM = 0.75;



function getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const rect = svg.getBoundingClientRect();
  const width = parseFloat(svg.getAttribute("width") || "") || rect.width;
  const height = parseFloat(svg.getAttribute("height") || "") || rect.height;
  return { width: width || 400, height: height || 300 };
}

function extractNodeLabel(el: Element): string {
  // Primary: text or tspan content inside the node group
  const textEl = el.querySelector("text");
  if (textEl) {
    const tspans = Array.from(textEl.querySelectorAll("tspan"))
      .map((t) => t.textContent?.trim() || "")
      .filter(Boolean);
    const joined = tspans.join(" ").trim();
    if (joined) return joined;
    const direct = textEl.textContent?.trim();
    if (direct) return direct;
  }

  // Try all text content under the group (handles some Mermaid variants)
  const anyText = el.textContent?.replace(/\s+/g, " ").trim();
  if (anyText) return anyText;

  // Fallbacks
  const title = el.querySelector("title");
  if (title?.textContent?.trim()) return title.textContent.trim();
  const labelAttr = el.getAttribute("data-label") || el.getAttribute("aria-label");
  if (labelAttr) return labelAttr.trim();
  return "";
}

function attachAndReport(
  svg: SVGSVGElement,
  onNodesChange: ((nodes: MermaidNodeInfo[]) => void) | undefined,
  onClick: ((node: { id: string; label: string }) => void) | undefined,
  highlight: MermaidNodeInfo | null | undefined,
  accentColor?: string,
) {
  const nodes = attachNodeInteractivity(svg, onClick, highlight ?? null, accentColor);
  onNodesChange?.(nodes);
  return nodes;
}

function attachNodeInteractivity(
  svg: SVGSVGElement,
  onClick?: (node: { id: string; label: string }) => void,
  selectedForHighlight?: MermaidNodeInfo | null,
  accentColor = "#d97a56",
): MermaidNodeInfo[] {
  // Clear previous selection classes
  svg.querySelectorAll(".node-selected").forEach((n) => n.classList.remove("node-selected"));

  // Robust node detection: prefer explicit classes, then heuristic for groups containing shape + text label
  let nodeEls = Array.from(
    svg.querySelectorAll<SVGGElement>("g.node, g.cluster")
  );

  if (nodeEls.length === 0) {
    // Fallback: any <g> that looks like a labeled node (common across Mermaid diagram types)
    nodeEls = Array.from(svg.querySelectorAll<SVGGElement>("g")).filter((g) => {
      const hasShape = g.querySelector("rect, circle, ellipse, polygon");
      const hasText = g.querySelector("text");
      return hasShape && hasText;
    });
  }

  const collected: MermaidNodeInfo[] = [];
  const seen = new Set<string>();

  nodeEls.forEach((el) => {
    // Make interactive
    el.style.cursor = "pointer";
    el.setAttribute("data-clickable-node", "true");
    el.setAttribute("title", "Click to comment on this step");
    el.querySelectorAll("rect, circle, ellipse, polygon, path").forEach((shape) => {
      (shape as SVGElement).style.cursor = "pointer";
    });

    // Collect label + id for the parent (e.g. as @-mention candidates).
    const label = extractNodeLabel(el);
    const id = el.id || el.getAttribute("data-id") || "";
    if (label) {
      // Dedupe on label so we don't list "A" twice when Mermaid renders
      // a node and its overlay shape.
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        collected.push({ id, label });
      }
    }

    // Always re-attach with the *current* onClick to avoid stale closures.
    // Remove previous handler if we stored one.
    const prevHandler = (el as any)._mermaidNodeClickHandler as EventListener | undefined;
    if (prevHandler) {
      el.removeEventListener("click", prevHandler);
    }

    const handler = (ev: Event) => {
      ev.stopPropagation();
      if (label && onClick) {
        onClick({ id, label });
      }
    };

    (el as any)._mermaidNodeClickHandler = handler;
    el.addEventListener("click", handler);

    // Apply highlight - prefer id match (for duplicate labels), fallback to label
    if (selectedForHighlight) {
      const wantId = selectedForHighlight.id || "";
      const wantLabel = selectedForHighlight.label;

      const idMatches = wantId && id && id === wantId;
      const labelMatches = label && label.toLowerCase() === wantLabel.toLowerCase();

      if (idMatches || (!wantId && labelMatches)) {
        el.classList.add("node-selected");
        const shape = el.querySelector("rect, circle, ellipse, polygon");
        if (shape) {
          shape.setAttribute("stroke", accentColor);
          shape.setAttribute("stroke-width", "3");
        }
      }
    }
  });

  return collected;
}

export function MermaidDiagram({
  chart,
  className = "",
  isStreaming = false,
  onNodeClick,
  selectedNodeLabel,
  onDeselect,
  selectedNode,
  onNodesChange,
  commentedNodes,
  onNodeCommentClick,
}: MermaidDiagramProps) {
  const { resolved, skinName } = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  // Keep the latest onNodesChange in a ref so attachAndReport (which is
  // called from a non-React effect) always uses the freshest callback without
  // forcing a re-run of the effect on every render.
  const onNodesChangeRef = useRef(onNodesChange);
  useEffect(() => {
    onNodesChangeRef.current = onNodesChange;
  }, [onNodesChange]);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  // 3.2: per-node comment dot positions, relative to the viewport container.
  // Recomputed on every render / zoom / scroll change.
  const [commentDots, setCommentDots] = useState<CommentDot[]>([]);
  const commentedNodesKey = useMemo(
    () => (commentedNodes ? serializeNodeCommentSummary(commentedNodes) : ""),
    [commentedNodes],
  );
  const [sanitizedChart, setSanitizedChart] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [debouncedChart, setDebouncedChart] = useState(chart);

  // Always call the latest onNodeClick even if captured in old closures (fixes stale handlers)
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  const onDeselectRef = useRef(onDeselect);
  useEffect(() => {
    onDeselectRef.current = onDeselect;
  }, [onDeselect]);

  useEffect(() => {
    if (!isStreaming) {
      setDebouncedChart(chart);
      return;
    }

    const timer = window.setTimeout(() => setDebouncedChart(chart), 180);
    return () => window.clearTimeout(timer);
  }, [chart, isStreaming]);

  const applyScale = useCallback(
    (svg: SVGSVGElement, natural: { width: number; height: number }, fit: number, zoomLevel: number) => {
      const scale = fit * zoomLevel;
      svg.style.width = `${natural.width * scale}px`;
      svg.style.height = `${natural.height * scale}px`;
      svg.style.maxWidth = "none";
      svg.style.maxHeight = "none";
      svg.style.display = "block";
    },
    []
  );

  const computeFitScale = useCallback(
    (natural: { width: number; height: number }) => {
      const viewport = viewportRef.current;
      if (!viewport) return 1;

      const availW = viewport.clientWidth - VIEWPORT_PADDING;
      const availH = viewport.clientHeight - VIEWPORT_PADDING;
      if (availW <= 0 || availH <= 0) return 1;

      return Math.min(availW / natural.width, availH / natural.height, 1);
    },
    []
  );

  const updateFit = useCallback(
    (zoomLevel = zoom) => {
      const host = svgHostRef.current;
      const svg = host?.querySelector("svg");
      if (!svg || !naturalSize) return;

      const fit = computeFitScale(naturalSize);
      applyScale(svg, naturalSize, fit, zoomLevel);
    },
    [applyScale, computeFitScale, naturalSize, zoom]
  );

  useEffect(() => {
    const chartSource = sanitizeMermaidSource(debouncedChart);
    setSanitizedChart(chartSource || null);
    if (!isStreaming) {
      setZoom(DEFAULT_ZOOM);
      setNaturalSize(null);
    }

    if (!chartSource) {
      setError(null);
      if (svgHostRef.current) svgHostRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;

    async function render(source: string) {
      setRendering(true);
      setError(null);

      try {
        const mermaid = (await import("mermaid")).default;

        const isDark = resolved === "dark";
        const accentColor = readCssVar("--accent") || "#d97a56";
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

        await mermaid.parse(source);
        const { svg } = await mermaid.render(`mermaid-${renderId}-${Date.now()}`, source);

        if (!cancelled && svgHostRef.current && viewportRef.current) {
          svgHostRef.current.innerHTML = svg;
          const svgEl = svgHostRef.current.querySelector("svg");
          if (svgEl) {
            const natural = getSvgDimensions(svgEl);
            setNaturalSize(natural);

            const availW = viewportRef.current.clientWidth - VIEWPORT_PADDING;
            const availH = viewportRef.current.clientHeight - VIEWPORT_PADDING;
            const fit =
              availW > 0 && availH > 0
                ? Math.min(availW / natural.width, availH / natural.height, 1)
                : 1;

            applyScale(svgEl, natural, fit, DEFAULT_ZOOM);

            // Attach node click handlers + apply selection highlight (3.2)
            const highlightNode = selectedNode ?? (selectedNodeLabel ? { id: "", label: selectedNodeLabel } : null);
            attachAndReport(
              svgEl,
              onNodesChangeRef.current,
              onNodeClickRef.current ?? onNodeClick,
              highlightNode,
              accentColor,
            );

            // Attach deselect on the SVG itself for clicks on diagram background / edges (nodes stopPropagation)
            if (onDeselectRef.current) {
              // Remove previous if any
              const prev = (svgEl as any)._bgDeselectHandler as EventListener | undefined;
              if (prev) svgEl.removeEventListener("click", prev);

              const bgHandler = (ev: MouseEvent) => {
                // If it bubbled from a node, the node already stopped it.
                // This will only fire for true background clicks inside the SVG.
                onDeselectRef.current?.();
              };
              (svgEl as any)._bgDeselectHandler = bgHandler;
              svgEl.addEventListener("click", bgHandler);
            }

            // Safety: re-attach shortly after in case the initial onNodeClick prop was not yet the final one
            // (handles some render timing in parent)
            setTimeout(() => {
              if (!cancelled && svgHostRef.current) {
                const freshSvg = svgHostRef.current.querySelector("svg");
                if (freshSvg) {
                  const freshHighlight = selectedNode ?? (selectedNodeLabel ? { id: "", label: selectedNodeLabel } : null);
                  attachAndReport(
                    freshSvg as SVGSVGElement,
                    onNodesChangeRef.current,
                    onNodeClickRef.current ?? onNodeClick,
                    freshHighlight,
                    accentColor,
                  );
                  // Re-attach deselect on fresh svg too
                  if (onDeselectRef.current) {
                    const prev = (freshSvg as any)._bgDeselectHandler as EventListener | undefined;
                    if (prev) freshSvg.removeEventListener("click", prev);
                    const bgHandler = () => onDeselectRef.current?.();
                    (freshSvg as any)._bgDeselectHandler = bgHandler;
                    freshSvg.addEventListener("click", bgHandler);
                  }
                }
              }
            }, 0);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    render(chartSource);

    return () => {
      cancelled = true;
    };
  }, [debouncedChart, isStreaming, renderId, applyScale, resolved, skinName]);

  useEffect(() => {
    if (!naturalSize) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => updateFit(zoom));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [naturalSize, zoom, updateFit]);

  useEffect(() => {
    if (!naturalSize) return;
    updateFit(zoom);
  }, [zoom, naturalSize, updateFit]);

  const applyCommentDots = useCallback((next: CommentDot[]) => {
    setCommentDots((prev) => (commentDotsEqual(prev, next) ? prev : next));
  }, []);

  // 3.2: re-measure comment dot positions whenever the diagram, zoom, or
  // the set of commented nodes changes. We use a rAF so the browser has
  // applied the SVG's `style.width/height` (set by updateFit) before we read
  // the bounding boxes.
  useEffect(() => {
    if (!commentedNodesKey) {
      applyCommentDots([]);
      return;
    }
    if (!commentedNodes) return;

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      const viewport = viewportRef.current;
      const svg = svgHostRef.current?.querySelector<SVGSVGElement>("svg");
      if (!viewport || !svg) return;
      applyCommentDots(measureCommentDots(viewport, svg, commentedNodes));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [applyCommentDots, commentedNodesKey, naturalSize, zoom]);

  // Re-measure when the viewport scrolls, so dots stay aligned with nodes.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !commentedNodesKey || !commentedNodes) return;

    let raf: number | null = null;
    const onScroll = () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const svg = svgHostRef.current?.querySelector<SVGSVGElement>("svg");
        if (!svg || !viewportRef.current || !commentedNodes) return;
        applyCommentDots(measureCommentDots(viewportRef.current, svg, commentedNodes));
      });
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [applyCommentDots, commentedNodesKey]);

  // Re-apply node highlight + fresh interactivity when selection or handler identity changes (3.2)
  useEffect(() => {
    const host = svgHostRef.current;
    const svg = host?.querySelector("svg");
    if (!svg) return;
    // Prefer full node for precise matching (handles duplicate labels via id)
    const highlight = selectedNode ?? (selectedNodeLabel ? { id: "", label: selectedNodeLabel } : null);
    const accentColor = readCssVar("--accent") || "#d97a56";
    attachAndReport(
      svg as SVGSVGElement,
      onNodesChangeRef.current,
      onNodeClickRef.current ?? onNodeClick,
      highlight,
      accentColor,
    );
  }, [selectedNode, selectedNodeLabel, onNodeClick, skinName, resolved]);

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  }

  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  }

  function resetZoom() {
    setZoom(1);
  }

  const displayPercent = Math.round(zoom * 100);

  if (!chart?.trim()) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-center p-8 ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-bg-panel border border-border flex items-center justify-center mb-4">
          <GitBranch className="w-7 h-7 text-text-soft" />
        </div>
        <p className="text-text-muted text-sm max-w-xs">
          Your process diagram will appear here as you chat with Hermes.
        </p>
        <p className="text-text-soft text-xs mt-2">Describe triggers, steps, and decisions on the right.</p>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full flex flex-col ${className}${
        isStreaming ? " mermaid-diagram--streaming" : ""
      }`}
    >
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-5 relative"
        onClick={(e) => {
          // Background click in the diagram viewport area (padding or outside the SVG) → deselect (3.2)
          // Clicks inside the SVG bubble from the svg element; nodes stopPropagation
          const target = e.target as HTMLElement;
          // Fire only for direct background areas, not overlays or controls inside
          if (target === e.currentTarget || target.hasAttribute("data-mermaid-host")) {
            onDeselectRef.current?.();
          }
        }}
      >
        {rendering && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-green" />
          </div>
        )}

        {isStreaming && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] text-green px-2 py-1 rounded-full border border-green-border bg-green-bg/90">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            Drawing…
          </div>
        )}

        {error ? (
          <div className="p-6 space-y-3 max-w-full">
            <p className="text-amber-400 text-sm">Diagram could not be rendered. Raw source shown below.</p>
            <pre className="text-xs text-text-muted bg-bg-panel border border-border rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap">
              {sanitizedChart || chart}
            </pre>
          </div>
        ) : (
          <>
            <div
              ref={svgHostRef}
              data-mermaid-host
              className="[&_svg]:drop-shadow-sm shrink-0"
            />
            {/* 3.2: per-node comment dots. Positioned absolutely in the
                viewport's coordinate space (so they scroll with the diagram). */}
            {!error && commentDots.map((dot) => (
              <NodeCommentDot
                key={dot.label}
                count={dot.count}
                x={dot.x}
                y={dot.y}
                onActivate={() => onNodeCommentClick?.(dot.label)}
              />
            ))}
          </>
        )}
      </div>

      {!error && naturalSize && (
        <div className="shrink-0 border-t border-border bg-bg/90 px-4 py-2 flex items-center justify-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-text-muted tabular-nums min-w-[3.5rem] text-center">
            {displayPercent}%
          </span>

          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-bg-muted mx-1" />

          <button
            onClick={resetZoom}
            className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text transition-colors flex items-center gap-1.5 text-xs px-3"
            title="Fit to screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit
          </button>
        </div>
      )}
    </div>
  );
}