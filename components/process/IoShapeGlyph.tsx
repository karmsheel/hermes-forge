"use client";

import {
  getIoShapeMeta,
  normalizeIoShape,
  type IoShapeId,
} from "@/lib/io-shape";

const SIZE = {
  sm: 18,
  md: 28,
  lg: 40,
} as const;

type GlyphSize = keyof typeof SIZE;

interface IoShapeGlyphProps {
  shape?: string | null;
  size?: GlyphSize;
  className?: string;
  /** Show accessible title with full label */
  title?: boolean;
}

/**
 * Compact SVG for process I/O shapes (Phase 6.1).
 * Token-colored via currentColor — set text-* on the parent.
 */
export function IoShapeGlyph({
  shape,
  size = "sm",
  className = "",
  title = true,
}: IoShapeGlyphProps) {
  const id = normalizeIoShape(shape);
  const meta = getIoShapeMeta(id);
  const px = SIZE[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title ? meta.label : undefined}
    >
      {title ? <title>{meta.label}</title> : null}
      <GlyphPaths shape={id} />
    </svg>
  );
}

function GlyphPaths({ shape }: { shape: IoShapeId }) {
  // Shared box in the center
  const box = (
    <rect
      x="12"
      y="5"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  );

  switch (shape) {
    case "siso":
      return (
        <>
          <ArrowLeft y={12} />
          {box}
          <ArrowRight y={12} />
        </>
      );
    case "simo":
      return (
        <>
          <ArrowLeft y={12} />
          {box}
          <ArrowRight y={7} />
          <ArrowRight y={17} />
        </>
      );
    case "miso":
      return (
        <>
          <ArrowLeft y={7} />
          <ArrowLeft y={17} />
          {box}
          <ArrowRight y={12} />
        </>
      );
    case "mimo":
      return (
        <>
          <ArrowLeft y={7} />
          <ArrowLeft y={17} />
          {box}
          <ArrowRight y={7} />
          <ArrowRight y={17} />
        </>
      );
  }
}

function ArrowLeft({ y }: { y: number }) {
  return (
    <>
      <line x1="2" y1={y} x2="11" y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline
        points={`8,${y - 3} 11,${y} 8,${y + 3}`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

function ArrowRight({ y }: { y: number }) {
  return (
    <>
      <line x1="29" y1={y} x2="38" y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline
        points={`35,${y - 3} 38,${y} 35,${y + 3}`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

interface IoShapeBadgeProps {
  shape?: string | null;
  className?: string;
  showLabel?: boolean;
}

/** Pill with glyph + optional short label for lists and details. */
export function IoShapeBadge({
  shape,
  className = "",
  showLabel = false,
}: IoShapeBadgeProps) {
  const meta = getIoShapeMeta(shape);
  return (
    <span
      className={`inline-flex items-center gap-1.5 pill text-[10px] bg-bg-muted text-text-muted border border-border ${className}`}
      title={`${meta.label} — ${meta.meaning}`}
    >
      <IoShapeGlyph shape={meta.id} size="sm" className="text-text-muted" title={false} />
      {showLabel ? <span className="truncate max-w-[9rem]">{meta.label}</span> : (
        <span className="font-mono uppercase tracking-wide">{meta.id}</span>
      )}
    </span>
  );
}
