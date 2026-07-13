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
  ListPlus,
  Loader2,
  MessageSquare,
  Navigation,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  PlugZap,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useShell } from "@/components/shell/ShellContext";
import { ConversationsMenu } from "@/components/workshop/ConversationsMenu";
import { MessageQueue } from "@/components/workshop/MessageQueue";
import { ProcessChat } from "@/components/workshop/ProcessChat";
import {
  loadActiveChatbarAgentId,
  saveActiveChatbarAgentId,
} from "@/lib/chatbar/active-agent";
import {
  loadActiveStudioConversationId,
  saveActiveStudioConversationId,
} from "@/lib/chatbar/active-conversation";
import {
  canSteerFromFeatures,
  steerActiveRun,
} from "@/lib/chatbar/capabilities";
import {
  composerControlState,
  composerKeyAction,
  resolveComposerSubmitAction,
  shouldAutoFlushQueuedTurn,
} from "@/lib/chatbar/composer-state";
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
import {
  pruneToolActivities,
  reduceToolActivities,
  type ToolActivity,
} from "@/lib/chatbar/runtime-events";
import { hermesApiBody } from "@/lib/hermes-models";
import {
  createQueuedMessage,
  waitUntilAgentsIdle,
  type QueuedMessage,
} from "@/lib/message-queue";
import type { ChatbarAgentOption, ChatMessage, Conversation } from "@/lib/types";
import { ChatbarContextChip } from "./ChatbarContextChip";
import { ChatbarDesktopBar } from "./ChatbarDesktopBar";
import { ContextReceipt } from "./ContextReceipt";
import { ToolActivityStrip } from "./ToolActivityStrip";
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
 * PR-1…PR-6: residency, studio, context, stop/queue/tools, process scope, model dock.
 */
export function ChatbarPanel() {
  const pathname = usePathname() || "/home";
  const {
    isOpen,
    collapse,
    isLeft,
    swapSide,
    side,
    residency,
    contextMode,
    setContextMode,
    pageRegistration,
    introRequestKey,
    processSession,
    isProcessScoped,
    composerFocusRequest,
    decisionSessionRequest,
  } = useChatbar();
  const { isConnected, status, config } = useHermesConnection();
  const { openHermesConnection, currentBusiness } = useShell();

  const blurb = pageBlurbForPath(pathname);
  const conn = connectionLabel(isConnected, status.state);
  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const swapLabel = isLeft ? "Move chat to the right" : "Move chat to the left";

  const [conversations, setConversations] = useState<StudioListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [hiredAgents, setHiredAgents] = useState<ChatbarAgentOption[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
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
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const lastIntroRequestKeyRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isDrainingQueueRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;
  sendingRef.current = sending;
  activeRunIdRef.current = activeRunId;

  /** Gateway advertises active-run steering (run_id still required at send time). */
  const canSteer = canSteerFromFeatures(status.features);
  const composerState = composerControlState({
    connected: isConnected,
    sending,
    draftText: draft,
    canSteer,
  });

  const businessId = currentBusiness?.id ?? null;
  const businessName = currentBusiness?.name ?? "this business";
  const activeAgent =
    hiredAgents.find((a) => a.id === activeAgentId) || hiredAgents[0] || null;

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title || "Studio chat";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, introBanner, toolActivities, queuedMessages, scrollToBottom]);

  const syncQueuedMessages = useCallback(() => {
    setQueuedMessages([...messageQueueRef.current]);
  }, []);

  const clearMessageQueue = useCallback(() => {
    messageQueueRef.current = [];
    syncQueuedMessages();
  }, [syncQueuedMessages]);

  const removeQueuedMessage = useCallback(
    (id: string) => {
      messageQueueRef.current = messageQueueRef.current.filter((item) => item.id !== id);
      syncQueuedMessages();
    },
    [syncQueuedMessages],
  );

  const enqueueDraft = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return false;
      messageQueueRef.current = [...messageQueueRef.current, createQueuedMessage(content)];
      syncQueuedMessages();
      setDraft("");
      toast.message("Message queued", {
        description: "Hermes will send it after the current reply finishes or stops.",
      });
      return true;
    },
    [syncQueuedMessages],
  );

  const stopCurrentTurn = useCallback(() => {
    if (!sendingRef.current) return;
    const runId = activeRunIdRef.current;
    abortRef.current?.abort();
    // Best-effort Hermes run interrupt when gateway advertises run ids
    if (runId && config?.baseUrl) {
      const base = config.baseUrl.replace(/\/$/, "");
      void fetch(`${base}/v1/runs/${encodeURIComponent(runId)}/stop`, {
        method: "POST",
        headers: config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : undefined,
      }).catch(() => {});
    }
    toast.message("Stopping Hermes…");
  }, [config]);

  const steerCurrentDraft = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    if (!sendingRef.current) {
      toast.message("Nothing to steer", {
        description: "Hermes is not currently running. Send or queue instead.",
      });
      return;
    }
    const runId = activeRunIdRef.current;
    if (!config?.baseUrl) {
      openHermesConnection();
      return;
    }
    if (!canSteerFromFeatures(status.features)) {
      toast.message("Steering unavailable", {
        description: "Queued instead — gateway does not advertise run steer yet.",
      });
      enqueueDraft(text);
      return;
    }
    if (!runId) {
      toast.message("Run id not ready", {
        description: "Queued instead — try steer again once streaming starts.",
      });
      enqueueDraft(text);
      return;
    }
    try {
      await steerActiveRun({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        runId,
        text,
      });
      setDraft("");
      toast.success("Steer sent", {
        description: "Hermes will apply it at the next injection point.",
      });
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Steer failed");
    }
  }, [draft, config, status.features, openHermesConnection, enqueueDraft]);

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

  const loadConversations = useCallback(
    async (agentIdOverride?: string | null) => {
      if (!businessId) {
        setConversations([]);
        setActiveConversationId(null);
        setHiredAgents([]);
        setActiveAgentId(null);
        setMessages([]);
        return;
      }

      setLoadingList(true);
      try {
        // Resolve agent first (saved → first hired)
        const agentsRes = await fetch("/api/personnel/agents");
        const agentsData = agentsRes.ok ? await agentsRes.json() : {};
        const hired: ChatbarAgentOption[] = (agentsData.hired || []).map(
          (a: ChatbarAgentOption) => ({
            id: a.id,
            displayName: a.displayName,
            description: a.description,
            model: a.model,
            profileKey: a.profileKey,
            iconKey: a.iconKey,
            isDefault: a.isDefault,
            hiredAt: a.hiredAt,
          }),
        );
        setHiredAgents(hired);

        const savedAgent = loadActiveChatbarAgentId(businessId);
        const preferred =
          agentIdOverride ||
          (savedAgent && hired.some((a) => a.id === savedAgent) ? savedAgent : null) ||
          hired[0]?.id ||
          null;
        setActiveAgentId(preferred);
        if (preferred) saveActiveChatbarAgentId(businessId, preferred);

        const q = preferred
          ? `?hermesAgentProfileId=${encodeURIComponent(preferred)}`
          : "";
        const res = await fetch(`/api/studio/conversations${q}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load conversations");
        }
        const data = await res.json();
        if (Array.isArray(data.hiredAgents) && data.hiredAgents.length) {
          setHiredAgents(data.hiredAgents);
        }
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
    },
    [businessId, loadConversationMessages],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Decision redirect: switch agent + conversation when requested
  useEffect(() => {
    if (!decisionSessionRequest) return;
    const { hermesAgentProfileId, conversationId, prefill } = decisionSessionRequest;
    void (async () => {
      if (hermesAgentProfileId) {
        setActiveAgentId(hermesAgentProfileId);
        if (businessId) saveActiveChatbarAgentId(businessId, hermesAgentProfileId);
        await loadConversations(hermesAgentProfileId);
      }
      if (conversationId) {
        setActiveConversationId(conversationId);
        if (businessId) saveActiveStudioConversationId(businessId, conversationId);
        await loadConversationMessages(conversationId);
      }
      if (prefill) setDraft(prefill);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to request key
  }, [decisionSessionRequest?.key]);

  const selectAgent = useCallback(
    async (agentId: string) => {
      if (!businessId || !agentId || agentId === activeAgentId) return;
      // Abort in-flight turn when switching persona
      abortRef.current?.abort();
      clearMessageQueue();
      setActiveAgentId(agentId);
      saveActiveChatbarAgentId(businessId, agentId);
      await loadConversations(agentId);
    },
    [businessId, activeAgentId, loadConversations, clearMessageQueue],
  );

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
        body: JSON.stringify({
          title: "New chat",
          hermesAgentProfileId: activeAgentId,
        }),
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
  }, [selectConversation, activeAgentId]);

  const sendMessageNow = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

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
      const controller = new AbortController();
      abortRef.current = controller;
      setSending(true);
      setToolActivities([]);
      setActiveRunId(null);

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
          signal: controller.signal,
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
        let stopped = false;

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
            } else if (block.event === "run_id") {
              const payload = parseSseJson<{ runId?: string }>(block.data);
              if (payload?.runId) setActiveRunId(payload.runId);
            } else if (block.event === "tool" || block.event === "tool_activity") {
              const payload = parseSseJson<Record<string, unknown>>(block.data);
              if (payload) {
                setToolActivities((prev) =>
                  pruneToolActivities(reduceToolActivities(prev, payload)),
                );
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
                stopped?: boolean;
              }>(block.data);
              if (payload?.stopped) stopped = true;
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

        if (stopped) {
          toast.message("Stopped", { description: "Hermes reply was interrupted." });
        }

        const refreshQ = activeAgentId
          ? `?hermesAgentProfileId=${encodeURIComponent(activeAgentId)}`
          : "";
        void fetch(`/api/studio/conversations${refreshQ}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data.conversations)) setConversations(data.conversations);
          })
          .catch(() => {});
      } catch (error) {
        const aborted =
          (error instanceof Error && error.name === "AbortError") || controller.signal.aborted;
        if (aborted) {
          // Partial text may already be on screen; keep assistant bubble if it has content
          setMessages((prev) => {
            const assistant = prev.find((m) => m.id === tempAssistantId);
            if (assistant?.content?.trim()) {
              return prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      content: `${m.content.trim()}\n\n_(stopped)_`,
                    }
                  : m,
              );
            }
            return prev.filter(
              (m) => m.id !== optimisticUser.id && m.id !== tempAssistantId,
            );
          });
          toast.message("Stopped");
        } else {
          toast.error(error instanceof Error ? error.message : "Chat failed");
          setMessages((prev) =>
            prev.filter((m) => m.id !== optimisticUser.id && m.id !== tempAssistantId),
          );
          setDraft((current) => (current.trim() ? current : text));
          if (activeIdRef.current === conversationId) {
            void loadConversationMessages(conversationId);
          }
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setSending(false);
        setActiveRunId(null);
        // Keep recent tool strip briefly, then clear on next send
        textareaRef.current?.focus();
      }
    },
    [
      isConnected,
      config,
      activeConversationId,
      activeAgentId,
      pathname,
      openHermesConnection,
      loadConversationMessages,
      contextMode,
      pageRegistration,
      businessId,
      blurb.routeKey,
      introBanner,
    ],
  );

  const handleComposerSubmit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;

    const action = resolveComposerSubmitAction({
      sending,
      draftText: text,
      canSteer,
    });

    if (action === "ignore") return;
    if (action === "steer") {
      void steerCurrentDraft();
      return;
    }
    if (action === "queue") {
      enqueueDraft(text);
      return;
    }

    // send
    setDraft("");
    void sendMessageNow(text);
  }, [draft, sending, canSteer, enqueueDraft, sendMessageNow, steerCurrentDraft]);

  const drainMessageQueue = useCallback(async () => {
    if (isDrainingQueueRef.current) return;
    if (sendingRef.current) return;
    if (messageQueueRef.current.length === 0) return;

    isDrainingQueueRef.current = true;
    try {
      while (messageQueueRef.current.length > 0) {
        await waitUntilAgentsIdle(() => sendingRef.current);
        if (messageQueueRef.current.length === 0) break;

        const [next, ...rest] = messageQueueRef.current;
        if (!shouldAutoFlushQueuedTurn({ autoSend: true, kind: "queued" })) break;

        messageQueueRef.current = rest;
        syncQueuedMessages();
        await sendMessageNow(next.content);
        await waitUntilAgentsIdle(() => sendingRef.current);
      }
    } finally {
      isDrainingQueueRef.current = false;
      if (messageQueueRef.current.length > 0 && !sendingRef.current) {
        void drainMessageQueue();
      }
    }
  }, [sendMessageNow, syncQueuedMessages]);

  useEffect(() => {
    void drainMessageQueue();
  }, [sending, drainMessageQueue]);

  const explainPage = useCallback(() => {
    setDraft("What am I looking at on this page? Summarize what is here and what I can do next.");
    textareaRef.current?.focus();
  }, []);

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = composerKeyAction(
      {
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        isComposing: event.nativeEvent.isComposing,
      },
      { sending, draftText: draft, canSteer },
    );
    if (action === "none") return;
    event.preventDefault();
    if (action === "submit") {
      handleComposerSubmit();
      return;
    }
    if (action === "steer") {
      void steerCurrentDraft();
      return;
    }
    if (action === "queue") {
      if (draft.trim()) enqueueDraft(draft);
    }
  };

  const busyLabel = sending
    ? "Hermes is thinking — new messages will queue"
    : null;

  const processMeterInput = {
    messages: processSession?.messages ?? [],
    draftText: "",
    contextText: pageRegistration?.snapshotLines?.join("\n") ?? "",
  };

  const processDiagnosticsInput = {
    route: pathname,
    businessId,
    businessName: currentBusiness?.name ?? null,
    contextMode,
    residency,
    side,
    isProcessScoped: true,
    processId: processSession?.processId ?? null,
    processName: processSession?.processName ?? null,
    conversationId: processSession?.conversationId ?? null,
    messageCount: processSession?.messages?.length ?? 0,
  };

  // Process mode: workshop registers a live process session (PR-5).
  // Studio history/composer are hidden; ProcessChat (mentions + slash) runs in the dock.
  if (isProcessScoped && processSession) {
    return (
      <aside
        className={`chatbar-panel chatbar-panel--side-${isLeft ? "left" : "right"} chatbar-panel--process${isOpen ? " is-open" : " is-collapsed"}`}
        aria-label="Hermes process chat"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        <header className="chatbar-panel__header">
          <div className="chatbar-panel__brand chatbar-panel__brand--session">
            <button
              type="button"
              className="chatbar-panel__icon-btn"
              onClick={collapse}
              title="Hide chat (Alt+H)"
              aria-label="Hide chat"
            >
              <CollapseIcon className="w-4 h-4" />
            </button>
            <MessageSquare className="chatbar-panel__brand-icon" aria-hidden />
            <div className="chatbar-panel__brand-copy min-w-0">
              <p className="chatbar-panel__eyebrow">Process</p>
              <span className="chatbar-panel__session-title" title={processSession.processName}>
                {processSession.processName}
              </span>
            </div>
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
              onClick={processSession.onOpenConnection}
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
          </div>
        </header>

        {processSession.conversations.length > 0 ? (
          <div className="chatbar-panel__process-forks">
            <ConversationsMenu
              conversations={processSession.conversations}
              activeConversationId={processSession.conversationId}
              processId={processSession.processId}
              onSelect={processSession.onSelectConversation}
              onChanged={processSession.onForked}
              onForked={processSession.onForked}
            />
          </div>
        ) : null}

        <div className="chatbar-panel__process-body">
          <ProcessChat
            messages={processSession.messages}
            processName={processSession.processName}
            isLoading={processSession.isLoading}
            onSend={processSession.onSend}
            onOpenConnection={processSession.onOpenConnection}
            queuedMessages={processSession.queuedMessages ?? []}
            onRemoveQueued={processSession.onRemoveQueued}
            onClearQueue={processSession.onClearQueue}
            agentBusyLabel={processSession.agentBusyLabel}
            composerFocusKey={
              (processSession.composerFocusKey ?? 0) +
              (composerFocusRequest?.key ?? 0)
            }
            selectedNode={processSession.selectedNode}
            onClearNodeContext={processSession.onClearNodeContext}
            mentionables={
              processSession.mentionables
                ? [...processSession.mentionables]
                : undefined
            }
            onSlashCommand={processSession.onSlashCommand}
            onCommentsChange={processSession.onCommentsChange}
            scrollToRequest={processSession.scrollToRequest}
            processId={processSession.processId}
            conversationId={processSession.conversationId}
            onSelectConversation={processSession.onSelectConversation}
            onConversationChanged={processSession.onForked}
            embedded
          />
        </div>

        <ChatbarDesktopBar
          meterInput={processMeterInput}
          diagnosticsInput={processDiagnosticsInput}
          disabled={!businessId}
        />
      </aside>
    );
  }

  return (
    <aside
      className={`chatbar-panel chatbar-panel--side-${isLeft ? "left" : "right"}${isOpen ? " is-open" : " is-collapsed"}`}
      aria-label="Hermes chat"
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
    >
      <header className="chatbar-panel__header chatbar-panel__header--stack">
        <div className="chatbar-panel__header-row">
          <div className="chatbar-panel__brand chatbar-panel__brand--session">
            <button
              type="button"
              className="chatbar-panel__icon-btn"
              onClick={collapse}
              title="Hide chat (Alt+H)"
              aria-label="Hide chat"
            >
              <CollapseIcon className="w-4 h-4" />
            </button>
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
              disabled={!businessId || !activeAgentId}
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
          </div>
        </div>
        {businessId ? (
          <div className="chatbar-panel__agent-row">
            <label className="chatbar-panel__agent-label" htmlFor="chatbar-agent">
              Agent
            </label>
            {hiredAgents.length === 0 ? (
              <a
                href="/personnel/hire?required=1"
                className="chatbar-panel__agent-empty"
              >
                Hire an agent to chat
              </a>
            ) : (
              <select
                id="chatbar-agent"
                className="chatbar-panel__agent-select"
                value={activeAgentId || hiredAgents[0]?.id || ""}
                onChange={(e) => void selectAgent(e.target.value)}
                disabled={sending || loadingList}
                title="Talk to a hired Hermes agent — each agent has its own conversation threads"
              >
                {hiredAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}
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
                Studio chat is saved per hired agent
                {activeAgent ? (
                  <>
                    {" "}
                    · talking to <strong>{activeAgent.displayName}</strong>
                  </>
                ) : null}
                . With{" "}
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

          {sending || toolActivities.length > 0 ? (
            <ToolActivityStrip activities={toolActivities} active={sending} />
          ) : null}

          <div ref={messagesEndRef} />
        </section>
      </div>

      <footer className="chatbar-panel__footer">
        <div className="chatbar-panel__composer-shell">
          <MessageQueue
            items={queuedMessages}
            busyLabel={busyLabel}
            onRemove={removeQueuedMessage}
            onClear={clearMessageQueue}
          />
          <div className="chatbar-panel__composer-meta">
            <label className="chatbar-panel__composer-label" htmlFor="chatbar-input">
              {activeAgent ? `Ask ${activeAgent.displayName}` : "Ask Hermes"}
            </label>
            <ChatbarContextChip
              mode={contextMode}
              onChange={setContextMode}
              pageTitle={blurb.title}
              disabled={false}
            />
          </div>
          <div className="chatbar-panel__composer-row">
            <textarea
              id="chatbar-input"
              ref={textareaRef}
              className="chatbar-panel__composer-input chatbar-panel__composer-input--live"
              rows={3}
              value={draft}
              disabled={!businessId}
              placeholder={
                !businessId
                  ? "Select a business to start chatting…"
                  : !isConnected
                    ? "Connect Hermes, then ask about this page…"
                    : sending
                      ? "Type to queue a follow-up while Hermes replies…"
                      : contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY
                        ? "Chat only — no page snapshot…"
                        : "Ask about this page or your business…"
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
            <div className="chatbar-panel__composer-actions chatbar-panel__composer-actions--row">
              {!composerState.controls.stop.hidden ? (
                <button
                  type="button"
                  className="chatbar-panel__stop"
                  disabled={composerState.controls.stop.disabled}
                  onClick={stopCurrentTurn}
                  title={composerState.controls.stop.label || "Stop"}
                  aria-label={composerState.controls.stop.label || "Stop Hermes"}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : null}
              {!composerState.controls.steer.hidden ? (
                <button
                  type="button"
                  className="chatbar-panel__steer"
                  disabled={composerState.controls.steer.disabled || !businessId}
                  onClick={() => void steerCurrentDraft()}
                  title={composerState.controls.steer.label || "Steer"}
                  aria-label={composerState.controls.steer.label || "Steer run"}
                >
                  <Navigation className="w-4 h-4" />
                </button>
              ) : null}
              {!composerState.controls.queue.hidden ? (
                <button
                  type="button"
                  className="chatbar-panel__queue"
                  disabled={composerState.controls.queue.disabled || !businessId}
                  onClick={() => {
                    if (draft.trim()) enqueueDraft(draft);
                  }}
                  title={composerState.controls.queue.label || "Queue"}
                  aria-label={composerState.controls.queue.label || "Queue message"}
                >
                  <ListPlus className="w-4 h-4" />
                </button>
              ) : null}
              {!composerState.controls.inlineSend.hidden ? (
                <button
                  type="button"
                  className="chatbar-panel__send"
                  disabled={
                    composerState.controls.inlineSend.disabled ||
                    !draft.trim() ||
                    !businessId
                  }
                  onClick={handleComposerSubmit}
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
          <ChatbarDesktopBar
            meterInput={{
              messages,
              draftText: draft,
              contextText: [
                contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY ? "" : shellSnapshotText,
                ...(pageRegistration?.snapshotLines ?? []),
                pageRegistration?.selection?.summary
                  ? `Selection: ${pageRegistration.selection.summary}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            }}
            diagnosticsInput={{
              route: pathname,
              businessId,
              businessName: currentBusiness?.name ?? null,
              contextMode,
              residency,
              side,
              isProcessScoped: false,
              conversationId: activeConversationId,
              messageCount: messages.length,
            }}
            disabled={!businessId}
          />
          <p className="chatbar-panel__composer-help">
            {sending
              ? canSteer
                ? "Stop · Steer · Queue while busy · "
                : "Stop ends the run · Enter queues while busy · "
              : "Enter sends · "}
            Scope chip · model dock · <kbd>Alt</kbd>+<kbd>H</kbd>
          </p>
        </div>
      </footer>
    </aside>
  );
}
