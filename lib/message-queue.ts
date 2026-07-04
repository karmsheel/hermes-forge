/**
 * 3.7 — Queued messages while background agents run.
 *
 * Users can keep typing clarifications while the chat reply or diagram/naming
 * subagents are in flight. Messages are held locally and drained FIFO once idle.
 */

export interface QueuedMessageOptions {
  nodeContext?: { nodeId?: string; label: string };
}

export interface QueuedMessage {
  id: string;
  content: string;
  nodeContext?: { nodeId?: string; label: string };
  createdAt: string;
}

export function createQueuedMessage(
  content: string,
  options?: QueuedMessageOptions,
): QueuedMessage {
  return {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    nodeContext: options?.nodeContext,
    createdAt: new Date().toISOString(),
  };
}

/** Poll until neither chat nor background agents are busy. */
export function waitUntilAgentsIdle(
  isBusy: () => boolean,
  intervalMs = 50,
): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!isBusy()) {
        resolve();
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}