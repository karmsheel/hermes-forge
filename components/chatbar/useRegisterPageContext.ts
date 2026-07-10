"use client";

import { useEffect } from "react";
import type { PageContextRegistration } from "@/lib/chatbar/context-protocol";
import { useChatbarOptional } from "./ChatbarProvider";

/**
 * Pages call this to register live selection / extra snapshot lines for PR-3.
 * Clears registration on unmount.
 */
export function useRegisterPageContext(registration: PageContextRegistration | null) {
  const chatbar = useChatbarOptional();

  useEffect(() => {
    if (!chatbar) return;
    chatbar.registerPageContext(registration);
    return () => {
      chatbar.registerPageContext(null);
    };
    // Serialize stable identity of registration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatbar,
    registration?.selection?.type,
    registration?.selection?.summary,
    registration?.pinned?.id,
    registration?.pinned?.label,
    registration?.pinned?.type,
    JSON.stringify(registration?.snapshotLines || []),
    JSON.stringify(registration?.selection?.details || null),
  ]);
}
