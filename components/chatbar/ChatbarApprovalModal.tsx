"use client";

import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { Overlay } from "@/components/ui/Overlay";
import type {
  HermesApprovalChoice,
  PendingRunApproval,
} from "@/lib/chatbar/runtime-events";

const CHOICE_COPY: Record<
  HermesApprovalChoice,
  { label: string; description: string; variant: "default" | "secondary" | "destructive" }
> = {
  once: {
    label: "Allow once",
    description: "Run this action now only",
    variant: "default",
  },
  session: {
    label: "Allow for session",
    description: "Same pattern for this run session",
    variant: "secondary",
  },
  always: {
    label: "Always allow",
    description: "Remember this pattern permanently",
    variant: "secondary",
  },
  deny: {
    label: "Deny",
    description: "Block this action and continue",
    variant: "destructive",
  },
};

export type ChatbarApprovalModalProps = {
  approval: PendingRunApproval | null;
  submitting?: boolean;
  onDecide: (choice: HermesApprovalChoice) => void;
  onDismiss?: () => void;
};

/**
 * Modal for Hermes tool/command approvals (`approval.request`).
 * Posts the user's choice via `POST /v1/runs/{id}/approval`.
 */
export function ChatbarApprovalModal({
  approval,
  submitting = false,
  onDecide,
  onDismiss,
}: ChatbarApprovalModalProps) {
  const [picked, setPicked] = useState<HermesApprovalChoice | null>(null);

  if (!approval) return null;

  const choices = approval.choices.length
    ? approval.choices
    : (["once", "deny"] as HermesApprovalChoice[]);

  return (
    <Overlay
      open={Boolean(approval)}
      onClose={() => {
        if (submitting) return;
        onDismiss?.();
      }}
      title="Hermes needs your approval"
      description={
        approval.description ||
        "A gated tool or command is waiting for your decision."
      }
      size="md"
      closeDisabled={submitting}
      elevated
    >
      <div className="chatbar-approval space-y-4">
        <div className="chatbar-approval__banner flex items-start gap-2 rounded-lg border border-border-soft bg-bg-subtle px-3 py-2 text-sm text-text-muted">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span>
            Hermes paused a run until you approve or deny. Denying blocks the
            action; allowing resumes the agent.
          </span>
        </div>

        {approval.command ? (
          <div className="chatbar-approval__command">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
              Command / action
            </div>
            <pre className="max-h-40 overflow-auto rounded-lg border border-border-soft bg-bg px-3 py-2 text-xs leading-relaxed text-text whitespace-pre-wrap break-all">
              {approval.command}
            </pre>
          </div>
        ) : null}

        <div className="text-xs text-text-muted">
          Run{" "}
          <code className="rounded bg-bg-subtle px-1 py-0.5 text-[0.7rem]">
            {approval.runId}
          </code>
        </div>

        <div className="chatbar-approval__actions flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {choices.map((choice) => {
            const copy = CHOICE_COPY[choice] || CHOICE_COPY.once;
            const busy = submitting && picked === choice;
            return (
              <Button
                key={choice}
                type="button"
                variant={copy.variant}
                size="sm"
                disabled={submitting}
                title={copy.description}
                onClick={() => {
                  setPicked(choice);
                  onDecide(choice);
                }}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {copy.label}
              </Button>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}