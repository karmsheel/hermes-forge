"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphFlowNodeData } from "@/lib/business-graph";

const KIND_STYLES: Record<
  string,
  { label: string; border: string; badge: string }
> = {
  business: {
    label: "Business",
    border: "border-accent/50",
    badge: "bg-accent/15 text-accent",
  },
  unit: {
    label: "Unit",
    border: "border-border",
    badge: "bg-bg-subtle text-text-muted",
  },
  capability: {
    label: "Capability",
    border: "border-border",
    badge: "bg-bg-muted text-text-muted",
  },
  process: {
    label: "Process",
    border: "border-border",
    badge: "bg-green-bg text-green",
  },
  step: {
    label: "Step",
    border: "border-border",
    badge: "bg-bg-subtle text-text-faint",
  },
};

function GraphKindNodeComponent({ data, selected }: NodeProps) {
  const d = data as GraphFlowNodeData;
  const style = KIND_STYLES[d.kind] ?? KIND_STYLES.unit!;

  return (
    <div
      className={`h-full w-full rounded-xl border bg-bg-elevated shadow-sm flex flex-col overflow-hidden px-3 py-2 ${
        selected ? "border-accent ring-1 ring-accent/40" : style.border
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-text-muted !border-border"
      />
      <span
        className={`self-start text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${style.badge}`}
      >
        {style.label}
      </span>
      <p
        className="text-sm font-medium text-text-strong mt-1 truncate leading-snug"
        title={d.name}
      >
        {d.name}
      </p>
      {typeof d.processCount === "number" &&
      (d.kind === "unit" || d.kind === "capability" || d.kind === "business") ? (
        <p className="text-[10px] text-text-muted mt-auto truncate">
          {d.processCount} process{d.processCount === 1 ? "" : "es"}
        </p>
      ) : d.status ? (
        <p className="text-[10px] text-text-muted mt-auto truncate">{d.status}</p>
      ) : d.description ? (
        <p className="text-[10px] text-text-faint mt-auto line-clamp-2">
          {d.description}
        </p>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-text-muted !border-border"
      />
    </div>
  );
}

export const GraphKindNode = memo(GraphKindNodeComponent);
