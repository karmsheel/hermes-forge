"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, GitBranch, Scissors } from "lucide-react";
import { Overlay } from "@/components/ui/Overlay";
import { hermesApiBody } from "@/lib/hermes-models";
import type { HermesConfig } from "@/lib/types";
import type { SplitAnalysis } from "@/lib/mermaid-graph";

/** Mirrors server ProcessSplitPlan — kept local so this client file never pulls prisma. */
type ProcessSplitPlan = {
  parent: {
    name: string;
    description: string;
    diagramMermaid: string;
    assistantNote: string;
  };
  child: {
    name: string;
    description: string;
    diagramMermaid: string;
    assistantNote: string;
  };
};

type Phase = "idle" | "planning" | "preview" | "applying";

export type SplitProcessDialogProps = {
  open: boolean;
  onClose: () => void;
  processId: string;
  processName: string;
  hermes: HermesConfig | null;
  /** Optional seed instruction (e.g. from /split args). */
  initialInstruction?: string;
  /** Parent provides forge-scoped fetch. */
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onApplied: (result: {
    process: unknown;
    split: {
      parentProcessId: string;
      childProcessId: string;
      childName: string;
      parentName: string;
    };
  }) => void;
};

export function SplitProcessDialog({
  open,
  onClose,
  processId,
  processName,
  hermes,
  initialInstruction = "",
  apiFetch,
  onApplied,
}: SplitProcessDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [instruction, setInstruction] = useState(initialInstruction);
  const [analysis, setAnalysis] = useState<SplitAnalysis | null>(null);
  const [plan, setPlan] = useState<ProcessSplitPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setInstruction(initialInstruction);
    setPlan(null);
    setError(null);

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`/api/processes/${processId}/split`);
        if (!res.ok) return;
        const data = (await res.json()) as { analysis?: SplitAnalysis };
        if (!cancelled && data.analysis) setAnalysis(data.analysis);
      } catch {
        /* analysis is optional for the dialog */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, processId, initialInstruction, apiFetch]);

  const handlePlan = useCallback(async () => {
    if (!hermes) {
      setError("Connect Hermes in Settings before planning a split.");
      return;
    }
    setError(null);
    setPhase("planning");
    try {
      const res = await apiFetch(`/api/processes/${processId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "plan",
          instruction:
            instruction.trim() ||
            "Split into two single-flow workflows for automation.",
          ...hermesApiBody(hermes),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to plan split"
        );
      }
      setPlan(data.plan as ProcessSplitPlan);
      if (data.analysis) setAnalysis(data.analysis as SplitAnalysis);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to plan split");
      setPhase("idle");
    }
  }, [apiFetch, hermes, instruction, processId]);

  const handleApply = useCallback(async () => {
    if (!plan) return;
    setError(null);
    setPhase("applying");
    try {
      const res = await apiFetch(`/api/processes/${processId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          plan,
          ...(hermes ? hermesApiBody(hermes) : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to apply split"
        );
      }
      onApplied({
        process: data.process,
        split: data.split,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply split");
      setPhase("preview");
    }
  }, [apiFetch, hermes, onApplied, onClose, plan, processId]);

  const busy = phase === "planning" || phase === "applying";

  return (
    <Overlay
      open={open}
      onClose={onClose}
      closeDisabled={busy}
      size="lg"
      title="Split into two workflows"
      description={`Peel a second process out of “${processName}” so each flow can be automated on its own. If this process is forged, it will reopen as draft after the split.`}
    >
      <div className="space-y-4">
        {analysis && analysis.componentCount > 0 && (
          <div className="rounded-lg border border-border bg-bg-subtle/60 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Detected flows
              <span className="normal-case font-normal text-text-soft">
                ({analysis.confidence} confidence)
              </span>
            </div>
            <ul className="space-y-1 text-text-muted">
              {analysis.components.map((c) => (
                <li key={c.id}>
                  <span className="text-text font-medium">{c.suggestedName}</span>
                  <span className="text-text-soft">
                    {" "}
                    — {c.labels.slice(0, 4).join(" · ")}
                    {c.labels.length > 4 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ul>
            {analysis.reasons[0] ? (
              <p className="text-xs text-text-soft mt-2">{analysis.reasons[0]}</p>
            ) : null}
          </div>
        )}

        {phase !== "preview" && phase !== "applying" && (
          <>
            <label className="block">
              <span className="text-xs text-text-muted">
                Instruction (optional)
              </span>
              <textarea
                className="input mt-1 w-full min-h-[72px] text-sm"
                placeholder='e.g. "Keep order intake here; peel off returns handling."'
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={() => void handlePlan()}
                disabled={busy || !hermes}
              >
                {phase === "planning" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Scissors className="w-4 h-4" />
                )}
                Preview split
              </button>
            </div>
            {!hermes && (
              <p className="text-xs text-amber">
                Connect Hermes to generate a split plan.
              </p>
            )}
          </>
        )}

        {(phase === "preview" || phase === "applying") && plan && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PlanCard
                title="Stays here (parent)"
                name={plan.parent.name}
                description={plan.parent.description}
                mermaid={plan.parent.diagramMermaid}
              />
              <PlanCard
                title="New workflow (child)"
                name={plan.child.name}
                description={plan.child.description}
                mermaid={plan.child.diagramMermaid}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setPlan(null);
                  setPhase("idle");
                }}
                disabled={busy}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary text-sm flex items-center gap-1.5"
                onClick={() => void handleApply()}
                disabled={busy}
              >
                {phase === "applying" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Scissors className="w-4 h-4" />
                )}
                Confirm split
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red" role="alert">
            {error}
          </p>
        )}
      </div>
    </Overlay>
  );
}

function PlanCard({
  title,
  name,
  description,
  mermaid,
}: {
  title: string;
  name: string;
  description: string;
  mermaid: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-text-soft mb-1">
        {title}
      </div>
      <div className="font-medium text-text text-sm truncate" title={name}>
        {name}
      </div>
      {description ? (
        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{description}</p>
      ) : null}
      <pre className="mt-2 text-[10px] leading-relaxed text-text-soft bg-bg-subtle rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
        {mermaid}
      </pre>
    </div>
  );
}
