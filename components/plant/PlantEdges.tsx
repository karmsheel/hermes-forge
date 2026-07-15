"use client";

import type { ProcessLinkDto } from "@/lib/process-links";
import {
  tileCenter,
  tileEdgePoint,
  type PlantTilePosition,
} from "@/lib/plant-layout";

interface PlantEdgesProps {
  links: ProcessLinkDto[];
  byId: Map<string, PlantTilePosition>;
  canvasWidth: number;
  canvasHeight: number;
  selectedLinkId?: string | null;
  onSelectLink?: (linkId: string) => void;
  /** When true, edges are interactive (click to select/delete). */
  interactive?: boolean;
}

export function PlantEdges({
  links,
  byId,
  canvasWidth,
  canvasHeight,
  selectedLinkId,
  onSelectLink,
  interactive = true,
}: PlantEdgesProps) {
  if (links.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      width={canvasWidth}
      height={canvasHeight}
      aria-hidden={!interactive}
    >
      <defs>
        <marker
          id="plant-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-muted)" />
        </marker>
        <marker
          id="plant-arrow-selected"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" />
        </marker>
      </defs>

      {links.map((link) => {
        const from = byId.get(link.fromProcessId);
        const to = byId.get(link.toProcessId);
        if (!from || !to) return null;

        const fromC = tileCenter(from);
        const toC = tileCenter(to);
        const start = tileEdgePoint(from, toC);
        const end = tileEdgePoint(to, fromC);
        const selected = link.id === selectedLinkId;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        return (
          <g key={link.id}>
            {/* Wider hit target */}
            {interactive ? (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="transparent"
                strokeWidth={14}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLink?.(link.id);
                }}
              />
            ) : null}
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={selected ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth={selected ? 2.5 : 1.75}
              strokeOpacity={selected ? 1 : 0.75}
              markerEnd={
                selected ? "url(#plant-arrow-selected)" : "url(#plant-arrow)"
              }
              className={interactive ? "pointer-events-none" : undefined}
            />
            {link.label ? (
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-[10px] pointer-events-none"
                style={{ fontSize: 10 }}
              >
                {link.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
