"use client";

import type { ProcessWithMessages } from "@/lib/types";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { IoShapeBadge } from "@/components/process/IoShapeGlyph";
import { getIoShapeMeta } from "@/lib/io-shape";

interface DetailsPanelProps {
  process: ProcessWithMessages;
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="text-sm text-text whitespace-pre-wrap">
        {value ? value : <span className="text-text-faint italic">Not set</span>}
      </dd>
    </div>
  );
}

export function DetailsPanel({ process }: DetailsPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <dl className="space-y-5 max-w-2xl">
        <DetailField label="Name" value={process.name} />
        <DetailField label="Description" value={process.description} />
        <DetailField label="Department" value={process.department} />
        <DetailField label="Trigger" value={process.trigger} />
        <DetailField label="Inputs" value={process.inputs} />
        <DetailField label="Outputs" value={process.outputs} />
        <DetailField label="Manual Steps" value={process.manualSteps} />

        <div className="space-y-1">
          <dt className="text-[10px] uppercase tracking-widest text-text-muted">Shape</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <IoShapeBadge shape={process.ioShape} showLabel />
            <span className="text-xs text-text-muted">
              {getIoShapeMeta(process.ioShape).meaning}
            </span>
          </dd>
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted">Status</h3>
          <div className="flex flex-wrap gap-2">
            <span className="pill text-[10px] bg-bg-muted text-text-muted border border-border">
              {PROCESS_STATUS_LABELS[process.status as keyof typeof PROCESS_STATUS_LABELS] ?? process.status}
            </span>
            {process.approvedAt && (
              <span className="pill pill-green text-[10px]">Approved</span>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted">Metrics</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Automation Score</div>
              <div className="text-sm text-text">{process.automationScore ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Est. Time Saved</div>
              <div className="text-sm text-text">
                {process.estimatedTimeSaved != null ? `${process.estimatedTimeSaved}h` : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Repetition</div>
              <div className="text-sm text-text">{process.repetition ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Business Value</div>
              <div className="text-sm text-text">{process.businessValue ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Complexity</div>
              <div className="text-sm text-text">{process.complexity ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-1">
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted">Timestamps</h3>
          <div className="text-xs text-text-muted space-y-1">
            <div>Created: {new Date(process.createdAt).toLocaleString()}</div>
            <div>Updated: {new Date(process.updatedAt).toLocaleString()}</div>
            {process.diagramUpdatedAt && (
              <div>Diagram updated: {new Date(process.diagramUpdatedAt).toLocaleString()}</div>
            )}
          </div>
        </div>
      </dl>
    </div>
  );
}
