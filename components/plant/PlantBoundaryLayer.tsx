"use client";

import type { PlacedBoundaryChip } from "@/lib/plant-boundary";

interface PlantBoundaryLayerProps {
  feeds: PlacedBoundaryChip[];
  products: PlacedBoundaryChip[];
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Outside-the-plant Inputs / Outcomes chips + dashed connectors (6.6 trail).
 */
export function PlantBoundaryLayer({
  feeds,
  products,
  canvasWidth,
  canvasHeight,
}: PlantBoundaryLayerProps) {
  if (feeds.length === 0 && products.length === 0) return null;

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
      aria-hidden
    >
      <svg
        className="absolute top-0 left-0 overflow-visible"
        width={canvasWidth}
        height={canvasHeight}
      >
        {feeds.map((chip) => (
          <line
            key={`line-${chip.id}`}
            x1={chip.x + chip.width}
            y1={chip.y + chip.height / 2}
            x2={chip.attachX}
            y2={chip.attachY}
            stroke="var(--text-faint)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ))}
        {products.map((chip) => (
          <line
            key={`line-${chip.id}`}
            x1={chip.x}
            y1={chip.y + chip.height / 2}
            x2={chip.attachX}
            y2={chip.attachY}
            stroke="var(--text-faint)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ))}
      </svg>

      {feeds.map((chip) => (
        <BoundaryChip key={chip.id} chip={chip} side="feed" />
      ))}
      {products.map((chip) => (
        <BoundaryChip key={chip.id} chip={chip} side="product" />
      ))}
    </div>
  );
}

function BoundaryChip({
  chip,
  side,
}: {
  chip: PlacedBoundaryChip;
  side: "feed" | "product";
}) {
  return (
    <div
      data-plant-boundary={side}
      title={`${side === "feed" ? "Input into" : "Outcome from"} ${chip.processName}`}
      className={`absolute flex items-center justify-center px-2 rounded-md border text-[11px] font-medium truncate ${
        side === "feed"
          ? "border-border bg-bg-elevated text-text-muted"
          : "border-border bg-bg-elevated text-text-muted"
      }`}
      style={{
        left: chip.x,
        top: chip.y,
        width: chip.width,
        height: chip.height,
      }}
    >
      <span className="truncate max-w-full">{chip.label}</span>
    </div>
  );
}
