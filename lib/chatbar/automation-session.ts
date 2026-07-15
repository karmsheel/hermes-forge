/**
 * Automation-scoped chat binding for the global chatbar.
 * Automation studio registers this while a process studio is open; chatbar
 * renders automation design chat instead of generic studio threads.
 */

import type { AutomationMessage } from "@/lib/automation-types";

export type AutomationSessionBinding = {
  processId: string;
  processName: string;
  messages: AutomationMessage[];
  isLoading: boolean;
  /** Optional label while plan extraction runs */
  extractingLabel?: string | null;
  onSend: (content: string) => void;
  onOpenConnection: () => void;
};

export function isAutomationSessionBinding(
  value: unknown,
): value is AutomationSessionBinding {
  if (!value || typeof value !== "object") return false;
  const v = value as AutomationSessionBinding;
  return (
    typeof v.processId === "string" &&
    v.processId.length > 0 &&
    typeof v.processName === "string" &&
    typeof v.onSend === "function" &&
    typeof v.onOpenConnection === "function" &&
    Array.isArray(v.messages)
  );
}
