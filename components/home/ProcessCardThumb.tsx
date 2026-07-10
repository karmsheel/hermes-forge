"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getProjectCardThumbStyle } from "@/lib/home/project-card-thumb";
import { sanitizeMermaidSource } from "@/lib/mermaid-sanitize";
import { renderMermaidSvg } from "@/lib/mermaid-render";

interface ProcessCardThumbProps {
  processId: string;
  name: string;
  diagramMermaid: string | null | undefined;
}

interface DiagramPreview {
  svg: string;
  width: number;
  height: number;
}

const THUMB_PAD_X = 8;
const THUMB_PAD_Y = 6;

/**
 * Recent-process card thumbnail: mini Mermaid diagram when source exists,
 * otherwise the process-name initial on the themed art strip.
 *
 * Diagrams are scaled to fit the thumb via an explicit transform (Mermaid
 * SVGs ship fixed pixel sizes that CSS max-width/height often fail to clamp).
 */
export function ProcessCardThumb({ processId, name, diagramMermaid }: ProcessCardThumbProps) {
  const { skin, resolved } = useTheme();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<DiagramPreview | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const source = sanitizeMermaidSource(diagramMermaid ?? null);

    if (!source) {
      setPreview(null);
      return;
    }

    void (async () => {
      const result = await renderMermaidSvg(
        source,
        `recent-card-${processId}-${Date.now()}`,
        resolved === "dark",
      );
      if (cancelled) return;
      if (!result.ok) {
        setPreview(null);
        return;
      }
      setPreview({
        svg: result.svg,
        width: Math.max(1, result.width),
        height: Math.max(1, result.height),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [processId, diagramMermaid, resolved, skin.name]);

  // Zoom out so the full diagram fits inside the thumb window.
  useEffect(() => {
    const el = thumbRef.current;
    if (!preview || !el) {
      setScale(1);
      return;
    }

    const fit = () => {
      const availW = Math.max(1, el.clientWidth - THUMB_PAD_X * 2);
      const availH = Math.max(1, el.clientHeight - THUMB_PAD_Y * 2);
      const next = Math.min(availW / preview.width, availH / preview.height);
      // Always fit-to-window (zoom out as far as needed); never upscale past 1.
      setScale(Number.isFinite(next) ? Math.min(1, Math.max(0.02, next)) : 1);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview]);

  const scaledW = preview ? preview.width * scale : 0;
  const scaledH = preview ? preview.height * scale : 0;

  return (
    <div
      ref={thumbRef}
      className={`process-card__thumb${preview ? " has-diagram" : ""}`}
      style={preview ? undefined : getProjectCardThumbStyle(name, skin, resolved)}
    >
      {preview ? (
        <div className="process-card__diagram" aria-hidden>
          {/* Outer box is the scaled layout size so flex centering stays correct. */}
          <div
            className="process-card__diagram-frame"
            style={{ width: scaledW, height: scaledH }}
          >
            <div
              className="process-card__diagram-scale"
              style={{
                width: preview.width,
                height: preview.height,
                transform: `scale(${scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
          </div>
        </div>
      ) : (
        <span className="process-card__initial">{name[0]?.toUpperCase() || "P"}</span>
      )}
    </div>
  );
}
