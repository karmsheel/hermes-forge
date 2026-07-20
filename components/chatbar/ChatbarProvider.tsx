"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { PageContextRegistration } from "@/lib/chatbar/context-protocol";
import {
  CHATBAR_CONTEXT_MODES,
  DEFAULT_CHATBAR_CONTEXT_MODE,
  loadChatbarContextMode,
  normalizeChatbarContextMode,
  saveChatbarContextMode,
  type ChatbarContextMode,
} from "@/lib/chatbar/context-scope";
import type { AutomationSessionBinding } from "@/lib/chatbar/automation-session";
import type { ProcessSessionBinding } from "@/lib/chatbar/process-session";
import { isChatbarHiddenPath } from "@/lib/chatbar/agent-label";
import {
  CHATBAR_RESIDENCY_MODES,
  CHATBAR_SIDES,
  DEFAULT_CHATBAR_RESIDENCY,
  DEFAULT_CHATBAR_SIDE,
  loadChatbarResidency,
  loadChatbarSide,
  normalizeChatbarResidency,
  normalizeChatbarSide,
  saveChatbarResidency,
  saveChatbarSide,
  toggleChatbarResidency,
  toggleChatbarSide,
  type ChatbarResidency,
  type ChatbarSide,
} from "@/lib/chatbar/residency";

interface ChatbarContextValue {
  residency: ChatbarResidency;
  isOpen: boolean;
  side: ChatbarSide;
  isLeft: boolean;
  isRight: boolean;
  setResidency: (r: ChatbarResidency) => void;
  setSide: (side: ChatbarSide) => void;
  toggle: () => void;
  open: () => void;
  collapse: () => void;
  /** Flip dock between left and right of the main content. */
  swapSide: () => void;

  /** PR-3: context scope mode */
  contextMode: ChatbarContextMode;
  setContextMode: (mode: ChatbarContextMode) => void;

  /** PR-3: live page registration (selection / extra snapshot lines) */
  pageRegistration: PageContextRegistration | null;
  registerPageContext: (provider: PageContextRegistration | null) => void;

  /** Bump when pages request a re-intro (e.g. /intro later) */
  introRequestKey: number;
  requestPageIntro: (routeKey?: string) => void;

  /**
   * PR-5: when set, chatbar is process-scoped (workshop mapping).
   * Studio threads are hidden; ProcessChat mounts inside the dock.
   */
  processSession: ProcessSessionBinding | null;
  registerProcessSession: (session: ProcessSessionBinding | null) => void;
  isProcessScoped: boolean;

  /**
   * When set, chatbar is automation-studio scoped.
   * Studio threads are hidden; AutomationChat mounts inside the dock.
   */
  automationSession: AutomationSessionBinding | null;
  registerAutomationSession: (session: AutomationSessionBinding | null) => void;
  isAutomationScoped: boolean;

  /** Focus process/studio composer; optional prefill */
  focusComposer: (opts?: { prefill?: string; submit?: boolean }) => void;
  composerFocusRequest: { key: number; prefill?: string; submit?: boolean } | null;

  /**
   * Open chatbar on a specific agent + studio conversation (decision redirect).
   * ChatbarPanel consumes decisionSessionRequest.
   */
  openDecisionSession: (opts: {
    hermesAgentProfileId?: string | null;
    conversationId?: string | null;
    prefill?: string;
  }) => void;
  decisionSessionRequest: {
    key: number;
    hermesAgentProfileId?: string | null;
    conversationId?: string | null;
    prefill?: string;
  } | null;
}

const ChatbarContext = createContext<ChatbarContextValue | null>(null);

export function ChatbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const chatbarHidden = isChatbarHiddenPath(pathname);
  const [residency, setResidencyState] = useState<ChatbarResidency>(DEFAULT_CHATBAR_RESIDENCY);
  const [side, setSideState] = useState<ChatbarSide>(DEFAULT_CHATBAR_SIDE);
  const [contextMode, setContextModeState] = useState<ChatbarContextMode>(
    DEFAULT_CHATBAR_CONTEXT_MODE,
  );
  const [pageRegistration, setPageRegistration] =
    useState<PageContextRegistration | null>(null);
  const [introRequestKey, setIntroRequestKey] = useState(0);
  const [processSession, setProcessSession] = useState<ProcessSessionBinding | null>(
    null,
  );
  const [automationSession, setAutomationSession] =
    useState<AutomationSessionBinding | null>(null);
  const [composerFocusRequest, setComposerFocusRequest] = useState<{
    key: number;
    prefill?: string;
    submit?: boolean;
  } | null>(null);
  const [decisionSessionRequest, setDecisionSessionRequest] = useState<{
    key: number;
    hermesAgentProfileId?: string | null;
    conversationId?: string | null;
    prefill?: string;
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setResidencyState(loadChatbarResidency());
    setSideState(loadChatbarSide());
    setContextModeState(loadChatbarContextMode());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveChatbarResidency(residency);
  }, [residency, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveChatbarSide(side);
  }, [side, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveChatbarContextMode(contextMode);
  }, [contextMode, hydrated]);

  const setResidency = useCallback((next: ChatbarResidency) => {
    setResidencyState(normalizeChatbarResidency(next));
  }, []);

  const setSide = useCallback((next: ChatbarSide) => {
    setSideState(normalizeChatbarSide(next));
  }, []);

  const setContextMode = useCallback((next: ChatbarContextMode) => {
    setContextModeState(normalizeChatbarContextMode(next));
  }, []);

  const registerPageContext = useCallback((provider: PageContextRegistration | null) => {
    setPageRegistration(provider);
  }, []);

  const registerProcessSession = useCallback((session: ProcessSessionBinding | null) => {
    setProcessSession(session);
  }, []);

  const registerAutomationSession = useCallback(
    (session: AutomationSessionBinding | null) => {
      setAutomationSession(session);
    },
    [],
  );

  const requestPageIntro = useCallback((_routeKey?: string) => {
    setIntroRequestKey((k) => k + 1);
  }, []);

  /** Open dock + focus composer (studio textarea or process RichComposer). */
  const requestComposerFocus = useCallback(
    (opts?: { prefill?: string; submit?: boolean }) => {
      setComposerFocusRequest({
        key: Date.now(),
        prefill: opts?.prefill,
        submit: opts?.submit,
      });
    },
    [],
  );

  const focusComposer = useCallback(
    (opts?: { prefill?: string; submit?: boolean }) => {
      setResidencyState(CHATBAR_RESIDENCY_MODES.OPEN);
      requestComposerFocus(opts);
    },
    [requestComposerFocus],
  );

  const openDecisionSession = useCallback(
    (opts: {
      hermesAgentProfileId?: string | null;
      conversationId?: string | null;
      prefill?: string;
    }) => {
      setResidencyState(CHATBAR_RESIDENCY_MODES.OPEN);
      setDecisionSessionRequest({
        key: Date.now(),
        hermesAgentProfileId: opts.hermesAgentProfileId,
        conversationId: opts.conversationId,
        prefill: opts.prefill,
      });
      if (opts.prefill) {
        requestComposerFocus({ prefill: opts.prefill });
      }
    },
    [requestComposerFocus],
  );

  const toggle = useCallback(() => {
    setResidencyState((current) => {
      const next = toggleChatbarResidency(current);
      if (next === CHATBAR_RESIDENCY_MODES.OPEN) {
        // Schedule after residency commit so the panel can leave width:0.
        queueMicrotask(() => {
          setComposerFocusRequest({ key: Date.now() });
        });
      }
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setResidencyState(CHATBAR_RESIDENCY_MODES.OPEN);
    requestComposerFocus();
  }, [requestComposerFocus]);

  const collapse = useCallback(() => {
    setResidencyState(CHATBAR_RESIDENCY_MODES.COLLAPSED);
  }, []);

  // Alt+H — match hermes-browser-extension default shortcut (disabled on setup).
  // Works even while focused in the composer so users can open *and* close.
  useEffect(() => {
    if (chatbarHidden) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) return;
      if (event.key.toLowerCase() !== "h") return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatbarHidden, toggle]);

  const swapSide = useCallback(() => {
    setSideState((current) => toggleChatbarSide(current));
  }, []);

  const value = useMemo(
    () => ({
      residency,
      isOpen: residency === CHATBAR_RESIDENCY_MODES.OPEN,
      side,
      isLeft: side === CHATBAR_SIDES.LEFT,
      isRight: side === CHATBAR_SIDES.RIGHT,
      setResidency,
      setSide,
      toggle,
      open,
      collapse,
      swapSide,
      contextMode,
      setContextMode,
      pageRegistration,
      registerPageContext,
      introRequestKey,
      requestPageIntro,
      processSession,
      registerProcessSession,
      isProcessScoped: Boolean(processSession),
      automationSession,
      registerAutomationSession,
      isAutomationScoped: Boolean(automationSession),
      focusComposer,
      composerFocusRequest,
      openDecisionSession,
      decisionSessionRequest,
    }),
    [
      residency,
      side,
      setResidency,
      setSide,
      toggle,
      open,
      collapse,
      swapSide,
      contextMode,
      setContextMode,
      pageRegistration,
      registerPageContext,
      introRequestKey,
      requestPageIntro,
      processSession,
      registerProcessSession,
      automationSession,
      registerAutomationSession,
      focusComposer,
      composerFocusRequest,
      openDecisionSession,
      decisionSessionRequest,
    ],
  );

  return <ChatbarContext.Provider value={value}>{children}</ChatbarContext.Provider>;
}

export function useChatbar() {
  const ctx = useContext(ChatbarContext);
  if (!ctx) {
    throw new Error("useChatbar must be used within ChatbarProvider");
  }
  return ctx;
}

/** Safe optional hook for pages outside the provider (should not happen in shell). */
export function useChatbarOptional() {
  return useContext(ChatbarContext);
}

export { CHATBAR_CONTEXT_MODES };
