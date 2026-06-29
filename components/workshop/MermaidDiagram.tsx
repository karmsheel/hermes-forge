"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { sanitizeMermaidSource } from "@/lib/mermaid-sanitize";

interface MermaidDiagramProps {
  chart: string | null;
  className?: string;
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const VIEWPORT_PADDING = 40;

let mermaidInitialized = false;

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

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [sanitizedChart, setSanitizedChart] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

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
    const chartSource = sanitizeMermaidSource(chart);
    setSanitizedChart(chartSource || null);
    setZoom(1);
    setNaturalSize(null);

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

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: "dark",
            themeVariables: {
              darkMode: true,
              background: "#09090b",
              primaryColor: "#27272a",
              primaryTextColor: "#fafafa",
              primaryBorderColor: "#52525b",
              lineColor: "#a1a1aa",
              secondaryColor: "#18181b",
              tertiaryColor: "#3f3f46",
              fontFamily: "system-ui, sans-serif",
            },
            flowchart: {
              htmlLabels: false,
              curve: "basis",
              padding: 12,
              nodeSpacing: 40,
              rankSpacing: 50,
            },
          });
          mermaidInitialized = true;
        }

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

            applyScale(svgEl, natural, fit, 1);
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
  }, [chart, renderId, applyScale]);

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
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <GitBranch className="w-7 h-7 text-zinc-600" />
        </div>
        <p className="text-zinc-400 text-sm max-w-xs">
          Your process diagram will appear here as you chat with Hermes.
        </p>
        <p className="text-zinc-600 text-xs mt-2">Describe triggers, steps, and decisions on the right.</p>
      </div>
    );
  }

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-5"
      >
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        )}

        {error ? (
          <div className="p-6 space-y-3 max-w-full">
            <p className="text-amber-400 text-sm">Diagram could not be rendered. Raw source shown below.</p>
            <pre className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap">
              {sanitizedChart || chart}
            </pre>
          </div>
        ) : (
          <div ref={svgHostRef} className="[&_svg]:drop-shadow-sm shrink-0" />
        )}
      </div>

      {!error && naturalSize && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/90 px-4 py-2 flex items-center justify-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-zinc-500 tabular-nums min-w-[3.5rem] text-center">
            {displayPercent}%
          </span>

          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          <button
            onClick={resetZoom}
            className="p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1.5 text-xs px-3"
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