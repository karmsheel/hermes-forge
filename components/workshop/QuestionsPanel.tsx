"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, User, Database, Hand, Package } from "lucide-react";
import type { ProcessWithMessages } from "@/lib/types";

interface QuestionsPanelProps {
  process: ProcessWithMessages;
  onUpdated?: (process: ProcessWithMessages) => void;
}

interface QuestionDef {
  field: "trigger" | "inputs" | "manualSteps" | "outputs";
  question: string;
  hint: string;
  icon: typeof User;
}

const QUESTIONS: QuestionDef[] = [
  {
    field: "trigger",
    question: "Who triggers this?",
    hint: "What role, event, or system kicks off this process?",
    icon: User,
  },
  {
    field: "inputs",
    question: "What systems are involved?",
    hint: "Tools, databases, spreadsheets, or APIs used during the process.",
    icon: Database,
  },
  {
    field: "manualSteps",
    question: "What's manual?",
    hint: "Steps done by hand — copy-paste, data entry, approvals, etc.",
    icon: Hand,
  },
  {
    field: "outputs",
    question: "What's the output?",
    hint: "The final deliverable, report, or state when the process completes.",
    icon: Package,
  },
];

export function QuestionsPanel({ process, onUpdated }: QuestionsPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({
    trigger: process.trigger ?? "",
    inputs: process.inputs ?? "",
    manualSteps: process.manualSteps ?? "",
    outputs: process.outputs ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Re-sync when process changes (e.g. user selects a different process)
  useEffect(() => {
    setValues({
      trigger: process.trigger ?? "",
      inputs: process.inputs ?? "",
      manualSteps: process.manualSteps ?? "",
      outputs: process.outputs ?? "",
    });
  }, [process.id, process.trigger, process.inputs, process.manualSteps, process.outputs]);

  function handleChange(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/processes/${process.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger: values.trigger || null,
          inputs: values.inputs || null,
          manualSteps: values.manualSteps || null,
          outputs: values.outputs || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const updated = await res.json();
      onUpdated?.({ ...process, ...updated });
      toast.success("Discovery answers saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save answers");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Discovery Questions</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Answer these to give the diagram agent better context. Answers feed directly into the process model.
            </p>
          </div>
        </div>

        {QUESTIONS.map(({ field, question, hint, icon: Icon }) => (
          <div key={field} className="rounded-xl border border-border bg-bg-panel p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-accent shrink-0" />
              <label className="text-sm font-medium text-text">{question}</label>
            </div>
            <p className="text-xs text-text-muted">{hint}</p>
            <textarea
              className="input w-full resize-none min-h-[60px] text-sm"
              value={values[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              placeholder="Type your answer..."
              rows={2}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save answers
        </button>
      </div>
    </div>
  );
}
