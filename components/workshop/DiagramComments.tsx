"use client";

/**
 * DiagramComments / node targeting helpers for 3.2
 *
 * Goal: Click node in Mermaid → give targeted correction → agent revises the step.
 *
 * For v1, this provides the indicator pill shown in the chat composer area
 * when a node is selected. The actual targeting is done by prefixing the
 * user message sent to chat (which flows into conversation history used
 * by the diagram subagent).
 */

export type NodeInfo = {
  id?: string;
  label: string;
};

interface NodeContextPillProps {
  label: string;
  onClear: () => void;
}

export function NodeContextPill({ label, onClear }: NodeContextPillProps) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-2 py-0.5 text-[10px]">
      <span className="text-accent">Node:</span>
      <span className="font-medium truncate max-w-[200px]">{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-text-muted hover:text-text-strong px-1"
        aria-label="Clear node target"
      >
        ×
      </button>
    </div>
  );
}
