/**
 * Page chat module — pages inject context/tools into the single global chatbar.
 * @see docs/superpowers/specs/2026-07-22-unified-global-chatbar-design.md
 */

import type { PageContextRegistration } from "@/lib/chatbar/context-protocol";
import type { Mentionable } from "@/components/workshop/rich-composer/parse";
import type { SlashCommandSpec } from "@/components/chatbar/ChatbarComposer";
import type { ChatMessage } from "@/lib/types";

export type PageChatPin = {
  type: "process" | "automation";
  id: string;
  label: string;
};

export type PageComposerChrome =
  | {
      kind: "node-target";
      label: string;
      onClear: () => void;
    }
  | null;

export type PageChatModule = {
  routeKey: string;
  /** Prompt pack id for Settings / future server routing. */
  promptPack?: string;
  /** Untrusted page context (also register via registerPageContext for snapshots). */
  context?: PageContextRegistration | null;
  pin?: PageChatPin;
  mentionables?: ReadonlyArray<Mentionable>;
  /** Slash commands owned by the page (e.g. /export, /split). */
  onSlashCommand?: (command: string, args: string) => boolean;
  composerChrome?: PageComposerChrome;
  /**
   * After a process chat turn completes with diagram side effects,
   * Workshop runs background agents.
   */
  onProcessTurnComplete?: (payload: {
    processId: string;
    runBackgroundAgents: boolean;
    conversationId?: string | null;
  }) => void;
  /**
   * After an automation design turn (Task 6).
   * Page reloads studio / runs plan extraction.
   */
  onAutomationTurnComplete?: (payload: {
    processId: string;
    runExtraction: boolean;
    cronLinked?: boolean;
    studio?: unknown;
  }) => void;
  /** Optional status chip (e.g. "Updating plan…"). */
  statusLabel?: string | null;
  /** Optional: comment dots / message sync for Workshop diagram. */
  onMessagesSynced?: (messages: ChatMessage[]) => void;
};

export function isProcessPin(
  pin: PageChatPin | null | undefined,
): pin is PageChatPin & { type: "process" } {
  return Boolean(pin && pin.type === "process" && pin.id);
}

export function isAutomationPin(
  pin: PageChatPin | null | undefined,
): pin is PageChatPin & { type: "automation" } {
  return Boolean(pin && pin.type === "automation" && pin.id);
}

/** Default on; set localStorage forge.chatbar.unifiedWorkshop=0 to roll back. */
export function isUnifiedWorkshopChatEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem("forge.chatbar.unifiedWorkshop");
    if (v === "0" || v === "false") return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Same flag for automation design cutover (Task 6). */
export function isUnifiedAutomationChatEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem("forge.chatbar.unifiedWorkshop");
    if (v === "0" || v === "false") return false;
  } catch {
    /* ignore */
  }
  return true;
}
