"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import { getIoShapeMeta } from "@/lib/io-shape";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";
import type { ForgeProcessNodeData } from "@/lib/plant-flow-project";

function statusClass(status: string): string {
  if (status === "forged" || status === "approved") {
    return "bg-green-bg text-green border-green-border";
  }
  if (status === "refined" || status === "reviewed") {
    return "bg-amber-bg text-amber border-border";
  }
  return "bg-bg-subtle text-text-muted border-border";
}

function ForgeProcessNodeComponent({ data, selected }: NodeProps) {
  const d = data as ForgeProcessNodeData;
  const meta = getIoShapeMeta(d.ioShape);
  const label =
    PROCESS_STATUS_LABELS[d.status as keyof typeof PROCESS_STATUS_LABELS] ??
    d.status;

  return (
    <div
      className={`h-full w-full rounded-xl border bg-bg-elevated shadow-sm flex flex-col overflow-hidden ${
        selected || d.selected
          ? "border-accent ring-1 ring-accent/40"
          : "border-border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-text-muted !border-border"
      />
      <div className="px-3 pt-3 pb-2 flex items-start gap-2 min-h-0 flex-1">
        <div className="shrink-0 text-text-muted mt-0.5">
          <IoShapeGlyph shape={d.ioShape} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-strong truncate" title={d.name}>
            {d.name}
          </p>
          <p className="text-[10px] text-text-muted truncate mt-0.5" title={meta.meaning}>
            {d.department}
          </p>
        </div>
      </div>
      <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border ${statusClass(d.status)}`}
        >
          {label}
        </span>
        <span className="text-[10px] text-text-faint uppercase tracking-wide">
          {d.ioShape}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-text-muted !border-border"
      />
    </div>
  );
}

export const ForgeProcessNode = memo(ForgeProcessNodeComponent);
