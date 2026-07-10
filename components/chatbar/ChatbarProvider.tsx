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
import type { PageContextRegistration } from "@/lib/chatbar/context-protocol";
import {
  CHATBAR_CONTEXT_MODES,
  DEFAULT_CHATBAR_CONTEXT_MODE,
  loadChatbarContextMode,
  normalizeChatbarContextMode,
  saveChatbarContextMode,
  type ChatbarContextMode,
} from "@/lib/chatbar/context-scope";
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
}

const ChatbarContext = createContext<ChatbarContextValue | null>(null);

export function ChatbarProvider({ children }: { children: ReactNode }) {
  const [residency, setResidencyState] = useState<ChatbarResidency>(DEFAULT_CHATBAR_RESIDENCY);
  const [side, setSideState] = useState<ChatbarSide>(DEFAULT_CHATBAR_SIDE);
  const [contextMode, setContextModeState] = useState<ChatbarContextMode>(
    DEFAULT_CHATBAR_CONTEXT_MODE,
  );
  const [pageRegistration, setPageRegistration] =
    useState<PageContextRegistration | null>(null);
  const [introRequestKey, setIntroRequestKey] = useState(0);
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

  // Alt+H — match hermes-browser-extension default shortcut
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) return;
      if (event.key.toLowerCase() !== "h") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      event.preventDefault();
      setResidencyState((current) => toggleChatbarResidency(current));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const requestPageIntro = useCallback((_routeKey?: string) => {
    setIntroRequestKey((k) => k + 1);
  }, []);

  const toggle = useCallback(() => {
    setResidencyState((current) => toggleChatbarResidency(current));
  }, []);

  const open = useCallback(() => {
    setResidencyState(CHATBAR_RESIDENCY_MODES.OPEN);
  }, []);

  const collapse = useCallback(() => {
    setResidencyState(CHATBAR_RESIDENCY_MODES.COLLAPSED);
  }, []);

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
