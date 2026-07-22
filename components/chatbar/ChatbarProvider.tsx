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
import type { PageChatModule } from "@/lib/chatbar/page-module";
import {
  isAutomationPin,
  isProcessPin,
  isUnifiedAutomationChatEnabled,
  isUnifiedWorkshopChatEnabled,
} from "@/lib/chatbar/page-module";
import { isChatbarHiddenPath } from "@/lib/chatbar/agent-label";
import {
  CHATBAR_EDGE_ALIGNS,
  CHATBAR_EDGE_PRESET_OFFSETS,
  CHATBAR_PREFS_CHANGED_EVENT,
  CHATBAR_RESIDENCY_MODES,
  CHATBAR_SIDES,
  DEFAULT_CHATBAR_EDGE_ALIGN,
  DEFAULT_CHATBAR_EDGE_OFFSET,
  DEFAULT_CHATBAR_RESIDENCY,
  DEFAULT_CHATBAR_SIDE,
  loadChatbarEdgeAlign,
  loadChatbarEdgeOffset,
  loadChatbarResidency,
  loadChatbarSide,
  normalizeChatbarEdgeAlign,
  normalizeChatbarEdgeOffset,
  normalizeChatbarResidency,
  normalizeChatbarSide,
  offsetForEdgeAlign,
  saveChatbarEdgeAlign,
  saveChatbarEdgeOffset,
  saveChatbarResidency,
  saveChatbarSide,
  snapEdgeOffset,
  toggleChatbarResidency,
  toggleChatbarSide,
  type ChatbarEdgeAlign,
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

  /** Vertical position of the collapsed edge tab (0 = top of range, 1 = bottom). */
  edgeOffset: number;
  edgeAlign: ChatbarEdgeAlign;
  /** Snap to a named preset (top / middle / bottom) or set custom via offset. */
  setEdgeAlign: (align: Exclude<ChatbarEdgeAlign, "custom">) => void;
  /**
   * Free edge position. When `snap` is true (default on drag end), magnetically
   * snaps to nearby presets; otherwise stores as custom.
   */
  setEdgeOffset: (offset: number, opts?: { snap?: boolean }) => void;
  /** Middle align + default offset. */
  resetEdgePosition: () => void;

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
   * PR-5 legacy: process-scoped ProcessChat mount.
   * Task 5: ignored when unified workshop chat + pageModule process pin.
   */
  processSession: ProcessSessionBinding | null;
  registerProcessSession: (session: ProcessSessionBinding | null) => void;
  isProcessScoped: boolean;

  /**
   * Task 5: page module injection (pin, mentions, slash, callbacks).
   * Preferred over processSession for Workshop.
   */
  pageModule: PageChatModule | null;
  registerPageModule: (module: PageChatModule | null) => void;
  /** Unified process pin mode (single panel tree). */
  isProcessPinned: boolean;
  /** Unified automation design pin (Task 6). */
  isAutomationPinned: boolean;

  /**
   * When set, chatbar is automation-studio scoped.
   * Studio threads are hidden; AutomationChat mounts inside the dock.
   */
  automationSession: AutomationSessionBinding | null;
  registerAutomationSession: (session: AutomationSessionBinding | null) => void;
  /** Legacy embed; false when isAutomationPinned. */
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
  const [edgeOffset, setEdgeOffsetState] = useState(DEFAULT_CHATBAR_EDGE_OFFSET);
  const [edgeAlign, setEdgeAlignState] = useState<ChatbarEdgeAlign>(DEFAULT_CHATBAR_EDGE_ALIGN);
  const [contextMode, setContextModeState] = useState<ChatbarContextMode>(
    DEFAULT_CHATBAR_CONTEXT_MODE,
  );
  const [pageRegistration, setPageRegistration] =
    useState<PageContextRegistration | null>(null);
  const [introRequestKey, setIntroRequestKey] = useState(0);
  const [processSession, setProcessSession] = useState<ProcessSessionBinding | null>(
    null,
  );
  const [pageModule, setPageModule] = useState<PageChatModule | null>(null);
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
    setEdgeOffsetState(loadChatbarEdgeOffset());
    setEdgeAlignState(loadChatbarEdgeAlign());
    setContextModeState(loadChatbarContextMode());
    setHydrated(true);
  }, []);

  // Settings (and other external writers) live outside this provider — rehydrate.
  useEffect(() => {
    function onPrefsChanged() {
      setResidencyState(loadChatbarResidency());
      setSideState(loadChatbarSide());
      setEdgeOffsetState(loadChatbarEdgeOffset());
      setEdgeAlignState(loadChatbarEdgeAlign());
    }
    window.addEventListener(CHATBAR_PREFS_CHANGED_EVENT, onPrefsChanged);
    return () => window.removeEventListener(CHATBAR_PREFS_CHANGED_EVENT, onPrefsChanged);
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
    saveChatbarEdgeOffset(edgeOffset);
  }, [edgeOffset, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveChatbarEdgeAlign(edgeAlign);
  }, [edgeAlign, hydrated]);

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

  const setEdgeAlign = useCallback((align: Exclude<ChatbarEdgeAlign, "custom">) => {
    const next = normalizeChatbarEdgeAlign(align);
    if (next === CHATBAR_EDGE_ALIGNS.CUSTOM) return;
    setEdgeAlignState(next);
    setEdgeOffsetState(offsetForEdgeAlign(next));
  }, []);

  const setEdgeOffset = useCallback((offset: number, opts?: { snap?: boolean }) => {
    const raw = normalizeChatbarEdgeOffset(offset);
    if (opts?.snap === false) {
      setEdgeOffsetState(raw);
      setEdgeAlignState(CHATBAR_EDGE_ALIGNS.CUSTOM);
      return;
    }
    const snapped = snapEdgeOffset(raw);
    setEdgeOffsetState(snapped.offset);
    setEdgeAlignState(snapped.align);
  }, []);

  const resetEdgePosition = useCallback(() => {
    setEdgeAlignState(CHATBAR_EDGE_ALIGNS.MIDDLE);
    setEdgeOffsetState(CHATBAR_EDGE_PRESET_OFFSETS.middle);
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

  const registerPageModule = useCallback((module: PageChatModule | null) => {
    setPageModule(module);
  }, []);

  const registerAutomationSession = useCallback(
    (session: AutomationSessionBinding | null) => {
      setAutomationSession(session);
    },
    [],
  );

  const isProcessPinned = Boolean(
    isUnifiedWorkshopChatEnabled() && isProcessPin(pageModule?.pin),
  );
  const isAutomationPinned = Boolean(
    isUnifiedAutomationChatEnabled() && isAutomationPin(pageModule?.pin),
  );
  /** Legacy ProcessChat tree only when not using unified pin mode. */
  const isProcessScoped =
    Boolean(processSession) && !isProcessPinned;
  /** Legacy AutomationChat tree only when not using unified pin mode. */
  const isAutomationScopedLegacy =
    Boolean(automationSession) && !isAutomationPinned;

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
      edgeOffset,
      edgeAlign,
      setEdgeAlign,
      setEdgeOffset,
      resetEdgePosition,
      contextMode,
      setContextMode,
      pageRegistration,
      registerPageContext,
      introRequestKey,
      requestPageIntro,
      processSession,
      registerProcessSession,
      isProcessScoped,
      pageModule,
      registerPageModule,
      isProcessPinned,
      isAutomationPinned,
      automationSession,
      registerAutomationSession,
      isAutomationScoped: isAutomationScopedLegacy,
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
      edgeOffset,
      edgeAlign,
      setEdgeAlign,
      setEdgeOffset,
      resetEdgePosition,
      contextMode,
      setContextMode,
      pageRegistration,
      registerPageContext,
      introRequestKey,
      requestPageIntro,
      processSession,
      registerProcessSession,
      isProcessScoped,
      pageModule,
      registerPageModule,
      isProcessPinned,
      isAutomationPinned,
      automationSession,
      registerAutomationSession,
      isAutomationScopedLegacy,
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
