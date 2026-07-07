"use client";

import { Loader2 } from "lucide-react";
import { Overlay } from "@/components/ui/Overlay";

interface HireAgentDialogProps {
  open: boolean;
  agentName: string;
  businessName: string;
  hiring: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function HireAgentDialog({
  open,
  agentName,
  businessName,
  hiring,
  onClose,
  onConfirm,
}: HireAgentDialogProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Hire agent"
      description={`Bring "${agentName}" into ${businessName}`}
      closeDisabled={hiring}
      size="sm"
    >
      <p className="text-sm text-text-muted">
        Hiring this agent will add them to your organization for{" "}
        <span className="font-medium text-text">{businessName}</span>. You will be able to assign
        this agent to processes, SOPs, and automations in the business.
      </p>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={hiring}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={hiring}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {hiring ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
        </button>
      </div>
    </Overlay>
  );
}