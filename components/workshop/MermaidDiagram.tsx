"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, GitBranch } from "lucide-react";
import { sanitizeMermaidSource } from "@/lib/mermaid-sanitize";

interface MermaidDiagramProps {
  chart: string | null;
  className?: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [sanitizedChart, setSanitizedChart] = useState<string | null>(null);

  useEffect(() => {
    const chartSource = sanitizeMermaidSource(chart);
    setSanitizedChart(chartSource || null);

    if (!chartSource) {
      setError(null);
      if (containerRef.current) containerRef.current.innerHTML = "";
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
              padding: 16,
            },
          });
          mermaidInitialized = true;
        }

        await mermaid.parse(source);
        const { svg } = await mermaid.render(`mermaid-${renderId}-${Date.now()}`, source);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
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
  }, [chart, renderId]);

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
    <div className={`relative h-full ${className}`}>
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      )}
      {error ? (
        <div className="p-6 space-y-3">
          <p className="text-amber-400 text-sm">Diagram could not be rendered. Raw source shown below.</p>
          <pre className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap">
            {sanitizedChart || chart}
          </pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full overflow-auto p-6 flex items-center justify-center [&_svg]:drop-shadow-sm"
        />
      )}
    </div>
  );
}