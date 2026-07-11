/**
 * Composer control FSM for the global chatbar (extension parity).
 * Ported from hermes-browser-extension `composerControlState` / related pure helpers.
 *
 * Visibility rules:
 * - idle + draft → Send
 * - sending + empty draft → Stop only
 * - sending + draft → Stop + Queue (+ Steer when canSteer, PR-6)
 */

export type BusyComposerSubmitAction = "send" | "queue" | "steer" | "ignore";

export type ComposerKeyAction = "none" | "submit" | BusyComposerSubmitAction;

export type ComposerControlFlags = {
  hidden: boolean;
  disabled: boolean;
  label?: string;
};

export type ComposerControlState = {
  hasDraft: boolean;
  hasSteerText: boolean;
  busyDraft: boolean;
  controls: {
    inlineSend: ComposerControlFlags;
    stop: ComposerControlFlags;
    queue: ComposerControlFlags;
    steer: ComposerControlFlags;
  };
  mainButton: {
    disabled: boolean;
    label: string;
  };
};

export type ComposerControlInput = {
  connected?: boolean;
  sending?: boolean;
  draftText?: string;
  attachmentCount?: number;
  /** Capability-gated; PR-4 defaults false, PR-6 wires Hermes steer. */
  canSteer?: boolean;
};

/**
 * What Enter / primary submit should do while a run may be active.
 * With canSteer=false (Forge PR-4 default), busy+text → queue.
 */
export function busyComposerSubmitAction({
  sending = false,
  draftText = "",
  attachmentCount = 0,
  canSteer = false,
}: ComposerControlInput = {}): BusyComposerSubmitAction {
  const hasText = Boolean(String(draftText || "").trim());
  const hasAttachments = Number(attachmentCount || 0) > 0;
  if (!sending) return "send";
  if (!hasText && !hasAttachments) return "ignore";
  if (hasText && !hasAttachments && canSteer) return "steer";
  return "queue";
}

/**
 * Map a keyboard event on the composer to a high-level action.
 * Enter (no Shift) → submit (send or busy action).
 * Ctrl/Cmd+Enter while sending → busy action explicitly (steer/queue).
 */
export function composerKeyAction(
  event: {
    key?: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    isComposing?: boolean;
  } = {},
  state: ComposerControlInput = {},
): ComposerKeyAction {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return "none";
  const explicitSteer = Boolean(event.ctrlKey || event.metaKey);
  if (explicitSteer && state.sending) {
    return busyComposerSubmitAction(state);
  }
  return "submit";
}

/** Resolve "submit" into send | queue | steer | ignore given current busy state. */
export function resolveComposerSubmitAction(
  state: ComposerControlInput = {},
): BusyComposerSubmitAction {
  return busyComposerSubmitAction(state);
}

export function composerControlState({
  connected = false,
  sending = false,
  draftText = "",
  attachmentCount = 0,
  canSteer = false,
}: ComposerControlInput = {}): ComposerControlState {
  const hasText = Boolean(String(draftText || "").trim());
  const hasAttachments = Number(attachmentCount || 0) > 0;
  const hasDraft = hasText || hasAttachments;
  const busyDraft = Boolean(sending && hasDraft);

  return {
    hasDraft,
    hasSteerText: hasText,
    busyDraft,
    controls: {
      inlineSend: {
        hidden: Boolean(sending),
        disabled: Boolean(sending || !connected || !hasDraft),
        label: connected ? "Send message" : "Connect to Hermes first",
      },
      stop: {
        hidden: !sending,
        disabled: !sending,
        label: "Stop Hermes",
      },
      queue: {
        hidden: !busyDraft,
        disabled: !connected || !busyDraft,
        label: "Queue message",
      },
      steer: {
        hidden: !busyDraft || !canSteer,
        disabled: !connected || !sending || !hasText || !canSteer,
        label: canSteer ? "Steer the current run" : "Run steering unavailable",
      },
    },
    mainButton: {
      disabled: !connected || Boolean(sending),
      label: sending ? "Hermes running" : "Ask Hermes",
    },
  };
}

export type QueuedMessageControlState = {
  steer: ComposerControlFlags & { title?: string };
  delete: ComposerControlFlags & { title?: string };
};

export function queuedMessageControlState({
  sending = false,
  text = "",
  canSteer = false,
}: {
  sending?: boolean;
  text?: string;
  canSteer?: boolean;
} = {}): QueuedMessageControlState {
  const hasSteerText = Boolean(String(text || "").trim());
  return {
    steer: {
      hidden: !canSteer,
      disabled: !sending || !hasSteerText || !canSteer,
      label: canSteer ? "Steer now" : "Steering unavailable",
      title: !canSteer
        ? "Connected Hermes runtime does not advertise active-run steering yet"
        : hasSteerText
          ? "Steer the current run with this queued message"
          : "Queued attachment-only turns cannot be steered",
    },
    delete: {
      hidden: false,
      disabled: false,
      label: "Delete queued",
      title: "Delete the queued message",
    },
  };
}

/** Whether a drained queue item should auto-send (vs steer-fallback that stays manual). */
export function shouldAutoFlushQueuedTurn(
  turn: { autoSend?: boolean; kind?: string } | null | undefined,
): boolean {
  return Boolean(turn && turn.autoSend !== false && turn.kind !== "steer-fallback");
}
