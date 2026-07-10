"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Info,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  PlugZap,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useShell } from "@/components/shell/ShellContext";
import {
  loadActiveStudioConversationId,
  saveActiveStudioConversationId,
} from "@/lib/chatbar/active-conversation";
import {
  buildPageIntroCopy,
  type ContextReceipt as ContextReceiptData,
} from "@/lib/chatbar/context-protocol";
import { CHATBAR_CONTEXT_MODES } from "@/lib/chatbar/context-scope";
import {
  clearIntroSeen,
  hasSeenIntro,
  markIntroSeen,
} from "@/lib/chatbar/intros";
import { pageBlurbForPath } from "@/lib/chatbar/page-registry";
import { parseSseBlocks, parseSseJson } from "@/lib/chatbar/parse-studio-sse";
import { hermesApiBody } from "@/lib/hermes-models";
import type { ChatMessage, Conversation } from "@/lib/types";
import { ChatbarContextChip } from "./ChatbarContextChip";
import { ContextReceipt } from "./ContextReceipt";
import { useChatbar } from "./ChatbarProvider";

function connectionLabel(isConnected: boolean, state: string) {
  if (isConnected) return { kind: "ok" as const, text: "Connected" };
  if (state === "discovering" || state === "testing") {
    return { kind: "warn" as const, text: "Connecting…" };
  }
  if (state === "error") return { kind: "error" as const, text: "Error" };
  return { kind: "warn" as const, text: "Not connected" };
}

type StudioListItem = Conversation & { _count?: { messages: number } };

type IntroBanner = {
  routeKey: string;
  title: string;
  body: string;
};

/**
 * Shell-level Hermes chat dock.
 * PR-1 residency · PR-2 studio chat · PR-3 context protocol + intro + receipt.
 */
export function ChatbarPanel() {
  const pathname = usePathname() || "/home";
  const {
    isOpen,
    collapse,
    isLeft,
    swapSide,
    contextMode,
    setContextMode,
    pageRegistration,
    introRequestKey,
  } = useChatbar();
  const { isConnected, status, config } = useHermesConnection();
  const { openHermesConnection, currentBusiness } = useShell();

  const blurb = pageBlurbForPath(pathname);
  const conn = connectionLabel(isConnected, status.state);
  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const swapLabel = isLeft ? "Move chat to the right" : "Move chat to the left";

  const [conversations, setConversations] = useState<StudioListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [receiptsByMessageId, setReceiptsByMessageId] = useState<
    Record<string, ContextReceiptData>
  >({});
  const [introBanner, setIntroBanner] = useState<IntroBanner | null>(null);
  const [shellSnapshotText, setShellSnapshotText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const lastIntroRequestKeyRef = useRef(0);
  activeIdRef.current = activeConversationId;

  const businessId = currentBusiness?.id ?? null;
  const businessName = currentBusiness?.name ?? "this business";

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title || "Studio chat";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, introBanner, scrollToBottom]);

  // Fetch shell-level page snapshot when follow-page (or pinned) + business + route change
  useEffect(() => {
    if (!businessId || !isOpen) return;
    if (contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY) {
      setShellSnapshotText("");
      return;
    }

    let cancelled = false;
    const q = new URLSearchParams({ route: pathname });
    void fetch(`/api/studio/page-snapshot?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.snapshot?.text) return;
        setShellSnapshotText(String(data.snapshot.text));
      })
      .catch(() => {
        if (!cancelled) setShellSnapshotText("");
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, pathname, contextMode, isOpen]);

  // First-visit intro (local, no API) when chat is open
  useEffect(() => {
    if (!isOpen || !businessId) {
      setIntroBanner(null);
      return;
    }

    const force = introRequestKey > lastIntroRequestKeyRef.current;
    if (force) {
      lastIntroRequestKeyRef.current = introRequestKey;
      clearIntroSeen(businessId, blurb.routeKey);
    } else if (hasSeenIntro(businessId, blurb.routeKey)) {
      setIntroBanner(null);
      return;
    }

    const snapParts = [shellSnapshotText];
    if (pageRegistration?.snapshotLines?.length) {
      snapParts.push(...pageRegistration.snapshotLines);
    }
    if (pageRegistration?.selection?.summary) {
      snapParts.push(`Selection: ${pageRegistration.selection.summary}`);
    }

    const body = buildPageIntroCopy({
      businessName,
      page: blurb,
      snapshotText:
        contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY
          ? undefined
          : snapParts.filter(Boolean).join("\n"),
    });

    setIntroBanner({
      routeKey: blurb.routeKey,
      title: `Welcome to ${blurb.title}`,
      body,
    });
  }, [
    isOpen,
    businessId,
    businessName,
    blurb,
    shellSnapshotText,
    pageRegistration,
    contextMode,
    introRequestKey,
    pathname,
  ]);

  const dismissIntro = useCallback(() => {
    if (businessId && introBanner) {
      markIntroSeen(businessId, introBanner.routeKey);
    }
    setIntroBanner(null);
  }, [businessId, introBanner]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/studio/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(
        (data.messages || []).map(
          (m: ChatMessage & { createdAt: string | Date }) => ({
            ...m,
            processId: m.processId ?? null,
            createdAt:
              typeof m.createdAt === "string"
                ? m.createdAt
                : new Date(m.createdAt).toISOString(),
          }),
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load chat");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!businessId) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    setLoadingList(true);
    try {
      const res = await fetch("/api/studio/conversations");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load conversations");
      }
      const data = await res.json();
      const list: StudioListItem[] = data.conversations || [];
      setConversations(list);

      const saved = loadActiveStudioConversationId(businessId);
      const pick =
        (saved && list.find((c) => c.id === saved)?.id) || list[0]?.id || null;

      setActiveConversationId(pick);
      if (pick) {
        saveActiveStudioConversationId(businessId, pick);
        await loadConversationMessages(pick);
      } else {
        setMessages([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load studio chat");
    } finally {
      setLoadingList(false);
    }
  }, [businessId, loadConversationMessages]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const selectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      setSessionMenuOpen(false);
      if (businessId) saveActiveStudioConversationId(businessId, id);
      await loadConversationMessages(id);
    },
    [businessId, loadConversationMessages],
  );

  const createConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create chat");
      }
      const created = await res.json();
      setConversations((prev) => [created, ...prev]);
      await selectConversation(created.id);
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create chat");
    }
  }, [selectConversation]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    if (!isConnected || !config?.baseUrl || !config.apiKey) {
      openHermesConnection();
      toast.error("Connect to Hermes first");
      return;
    }

    if (!activeConversationId) {
      toast.error("No studio conversation open");
      return;
    }

    if (businessId && introBanner) {
      markIntroSeen(businessId, introBanner.routeKey);
      setIntroBanner(null);
    }

    const conversationId = activeConversationId;
    const firstVisit = businessId ? !hasSeenIntro(businessId, blurb.routeKey) : false;
    setDraft("");
    setSending(true);

    const optimisticUser: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      processId: null,
      conversationId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      optimisticUser,
      {
        id: tempAssistantId,
        processId: null,
        conversationId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch(`/api/studio/conversations/${conversationId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          route: pathname,
          contextMode,
          firstVisit,
          registration: pageRegistration,
          ...hermesApiBody(config),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Chat failed (${res.status})`);
      }

      if (!res.body) throw new Error("Empty stream from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";
      let resolvedUserId = optimisticUser.id;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.rest;

        for (const block of parsed.blocks) {
          if (block.event === "user") {
            const user = parseSseJson<ChatMessage>(block.data);
            if (user?.id) {
              resolvedUserId = user.id;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optimisticUser.id ? { ...user, processId: null } : m,
                ),
              );
            }
          } else if (block.event === "receipt") {
            const payload = parseSseJson<{
              messageId?: string;
              receipt?: ContextReceiptData;
            }>(block.data);
            if (payload?.receipt) {
              const mid = payload.messageId || resolvedUserId;
              setReceiptsByMessageId((prev) => ({
                ...prev,
                [mid]: payload.receipt!,
                [optimisticUser.id]: payload.receipt!,
              }));
            }
          } else if (block.event === "delta") {
            const payload = parseSseJson<{ text?: string }>(block.data);
            if (payload?.text) {
              streamed += payload.text;
              const snapshot = streamed;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, content: snapshot } : m,
                ),
              );
            }
          } else if (block.event === "done") {
            const payload = parseSseJson<{
              message?: ChatMessage;
              title?: string;
              receipt?: ContextReceiptData;
            }>(block.data);
            if (payload?.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId || m.id === payload.message!.id
                    ? {
                        ...payload.message!,
                        processId: payload.message!.processId ?? null,
                      }
                    : m,
                ),
              );
            }
            if (payload?.receipt) {
              setReceiptsByMessageId((prev) => ({
                ...prev,
                [resolvedUserId]: payload.receipt!,
                [optimisticUser.id]: payload.receipt!,
              }));
            }
            if (payload?.title) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId ? { ...c, title: payload.title! } : c,
                ),
              );
            }
          } else if (block.event === "error") {
            const payload = parseSseJson<{ error?: string }>(block.data);
            throw new Error(payload?.error || "Stream error");
          }
        }
      }

      if (buffer.trim()) {
        const parsed = parseSseBlocks(buffer, { flush: true });
        for (const block of parsed.blocks) {
          if (block.event === "done") {
            const payload = parseSseJson<{
              message?: ChatMessage;
              title?: string;
              receipt?: ContextReceiptData;
            }>(block.data);
            if (payload?.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? {
                        ...payload.message!,
                        processId: payload.message!.processId ?? null,
                      }
                    : m,
                ),
              );
            }
            if (payload?.title) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId ? { ...c, title: payload.title! } : c,
                ),
              );
            }
          }
        }
      }

      if (businessId) {
        markIntroSeen(businessId, blurb.routeKey);
      }

      void fetch("/api/studio/conversations")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.conversations)) setConversations(data.conversations);
        })
        .catch(() => {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed");
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticUser.id && m.id !== tempAssistantId),
      );
      setDraft(text);
      if (activeIdRef.current === conversationId) {
        void loadConversationMessages(conversationId);
      }
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [
    draft,
    sending,
    isConnected,
    config,
    activeConversationId,
    pathname,
    openHermesConnection,
    loadConversationMessages,
    contextMode,
    pageRegistration,
    businessId,
    blurb.routeKey,
    introBanner,
  ]);

  const explainPage = useCallback(() => {
    setDraft("What am I looking at on this page? Summarize what is here and what I can do next.");
    textareaRef.current?.focus();
  }, []);

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <aside
      className={`chatbar-panel chatbar-panel--side-${isLeft ? "left" : "right"}${isOpen ? " is-open" : " is-collapsed"}`}
      aria-label="Hermes chat"
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
    >
      <header className="chatbar-panel__header">
        <div className="chatbar-panel__brand chatbar-panel__brand--session">
          <button
            type="button"
            className="chatbar-panel__session-btn"
            onClick={() => setSessionMenuOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={sessionMenuOpen}
            title="Switch studio conversation"
          >
            <MessageSquare className="chatbar-panel__brand-icon" aria-hidden />
            <span className="chatbar-panel__session-title">{activeTitle}</span>
            <span className="chatbar-panel__session-caret" aria-hidden>
              ⌄
            </span>
          </button>
          <button
            type="button"
            className="chatbar-panel__icon-btn"
            onClick={() => void createConversation()}
            title="New studio chat"
            aria-label="New studio chat"
            disabled={!businessId}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="chatbar-panel__header-actions">
          <span
            className={`chatbar-panel__pill chatbar-panel__pill--${conn.kind}`}
            title={status.error || conn.text}
            role="status"
          >
            {conn.text}
          </span>
          <button
            type="button"
            className="chatbar-panel__icon-btn"
            onClick={openHermesConnection}
            title="Hermes connection"
            aria-label="Hermes connection"
          >
            <PlugZap className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="chatbar-panel__icon-btn"
            onClick={swapSide}
            title={swapLabel}
            aria-label={swapLabel}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="chatbar-panel__icon-btn"
            onClick={collapse}
            title="Hide chat (Alt+H)"
            aria-label="Hide chat"
          >
            <CollapseIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {sessionMenuOpen ? (
        <section className="chatbar-panel__session-menu" role="dialog" aria-label="Studio conversations">
          <div className="chatbar-panel__session-list">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chatbar-panel__session-item${c.id === activeConversationId ? " is-active" : ""}`}
                onClick={() => void selectConversation(c.id)}
              >
                <strong>{c.title}</strong>
                <span>{c._count?.messages ?? 0} messages</span>
              </button>
            ))}
            {conversations.length === 0 ? (
              <p className="chatbar-panel__session-empty">No studio chats yet.</p>
            ) : null}
          </div>
          <button
            type="button"
            className="chatbar-panel__session-new"
            onClick={() => void createConversation()}
          >
            + New studio chat
          </button>
        </section>
      ) : null}

      <div className="chatbar-panel__body">
        <section className="chatbar-panel__page-card" aria-label="Current page">
          <div className="chatbar-panel__page-card-top">
            <p className="chatbar-panel__eyebrow">This page</p>
            <button
              type="button"
              className="chatbar-panel__explain-btn"
              onClick={explainPage}
              title="Prefill: explain this page"
            >
              <Sparkles className="w-3 h-3" aria-hidden />
              Explain
            </button>
          </div>
          <h2 className="chatbar-panel__page-title">{blurb.title}</h2>
          <p className="chatbar-panel__page-purpose">{blurb.purpose}</p>
          {currentBusiness ? (
            <p className="chatbar-panel__business">
              Business · <strong>{currentBusiness.name}</strong>
            </p>
          ) : (
            <p className="chatbar-panel__business chatbar-panel__business--muted">
              No active business selected
            </p>
          )}
          {contextMode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY &&
          pageRegistration?.selection?.summary ? (
            <p className="chatbar-panel__selection">
              Selection · {pageRegistration.selection.summary}
            </p>
          ) : null}
        </section>

        <section className="chatbar-panel__messages" aria-live="polite">
          {introBanner ? (
            <div className="chatbar-panel__intro" role="status">
              <div className="chatbar-panel__intro-head">
                <Info className="w-3.5 h-3.5" aria-hidden />
                <strong>{introBanner.title}</strong>
              </div>
              <div className="chatbar-panel__intro-body">{introBanner.body}</div>
              <div className="chatbar-panel__intro-actions">
                <button type="button" className="chatbar-panel__intro-dismiss" onClick={dismissIntro}>
                  Got it
                </button>
                <button
                  type="button"
                  className="chatbar-panel__intro-dismiss chatbar-panel__intro-dismiss--primary"
                  onClick={() => {
                    dismissIntro();
                    explainPage();
                  }}
                >
                  Ask Hermes
                </button>
              </div>
            </div>
          ) : null}

          {loadingList || loadingMessages ? (
            <div className="chatbar-panel__messages-status">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading chat…
            </div>
          ) : null}

          {!loadingList && !loadingMessages && messages.length === 0 && !introBanner ? (
            <div className="chatbar-panel__empty">
              <div className="chatbar-panel__empty-orb" aria-hidden />
              <h3 className="chatbar-panel__empty-title">Ask Hermes about this page</h3>
              <p className="chatbar-panel__empty-copy">
                Studio chat is saved per business. With{" "}
                <strong>Follow page</strong>, Hermes receives a live snapshot of what is on
                screen (redacted, no secrets).
              </p>
              {!isConnected ? (
                <button
                  type="button"
                  className="btn-primary chatbar-panel__cta"
                  onClick={openHermesConnection}
                >
                  <PlugZap className="w-4 h-4" aria-hidden />
                  Connect to Hermes
                </button>
              ) : (
                <p className="chatbar-panel__empty-hint">
                  Try: “What can I do on this page?” or “What am I looking at?”
                </p>
              )}
            </div>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const isStreamingEmpty =
              !isUser && sending && !message.content && message.id.startsWith("temp-");
            const receipt = isUser ? receiptsByMessageId[message.id] : undefined;
            return (
              <article
                key={message.id}
                className={`chatbar-panel__message chatbar-panel__message--${message.role}`}
              >
                <div className="chatbar-panel__message-role">
                  {isUser ? "You" : "Hermes"}
                </div>
                <div className="chatbar-panel__message-content">
                  {isStreamingEmpty ? (
                    <span className="chatbar-panel__thinking">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                    </span>
                  ) : (
                    message.content
                  )}
                </div>
                {receipt ? <ContextReceipt receipt={receipt} /> : null}
              </article>
            );
          })}
          <div ref={messagesEndRef} />
        </section>
      </div>

      <footer className="chatbar-panel__footer">
        <div className="chatbar-panel__composer-shell">
          <div className="chatbar-panel__composer-meta">
            <label className="chatbar-panel__composer-label" htmlFor="chatbar-input">
              Ask Hermes
            </label>
            <ChatbarContextChip
              mode={contextMode}
              onChange={setContextMode}
              pageTitle={blurb.title}
              disabled={sending}
            />
          </div>
          <div className="chatbar-panel__composer-row">
            <textarea
              id="chatbar-input"
              ref={textareaRef}
              className="chatbar-panel__composer-input chatbar-panel__composer-input--live"
              rows={3}
              value={draft}
              disabled={sending || !businessId}
              placeholder={
                !businessId
                  ? "Select a business to start chatting…"
                  : !isConnected
                    ? "Connect Hermes, then ask about this page…"
                    : contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY
                      ? "Chat only — no page snapshot…"
                      : "Ask about this page or your business…"
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
            <button
              type="button"
              className="chatbar-panel__send"
              disabled={sending || !draft.trim() || !businessId}
              onClick={() => void handleSend()}
              title="Send (Enter)"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="chatbar-panel__composer-help">
            Enter sends · Scope chip controls page context · <kbd>Alt</kbd>+<kbd>H</kbd> toggles
          </p>
        </div>
      </footer>
    </aside>
  );
}
