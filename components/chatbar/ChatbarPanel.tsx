"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Crosshair,
  Hammer,
  Info,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useShell } from "@/components/shell/ShellContext";
import { ConversationsMenu } from "@/components/workshop/ConversationsMenu";
import { MessageQueue } from "@/components/workshop/MessageQueue";
import {
  loadActiveChatbarAgentId,
  saveActiveChatbarAgentId,
} from "@/lib/chatbar/active-agent";
import {
  formatChatbarAgentLabel,
  isChatbarOverlordOnlyPath,
  sortChatbarAgentsWithOverlordFirst,
} from "@/lib/chatbar/agent-label";
import {
  clearActiveStudioConversationId,
  loadActiveStudioConversationId,
  saveActiveStudioConversationId,
} from "@/lib/chatbar/active-conversation";
import {
  consumePendingStudioReply,
  peekPendingStudioReply,
} from "@/lib/chatbar/pending-studio-reply";
import {
  approveActiveRun,
  canSteerFromFeatures,
  steerActiveRun,
} from "@/lib/chatbar/capabilities";
import {
  composerControlState,
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
  isApprovalResolvedEvent,
  parsePendingRunApproval,
  pruneToolActivities,
  reduceToolActivities,
  type HermesApprovalChoice,
  type PendingRunApproval,
  type ToolActivity,
} from "@/lib/chatbar/runtime-events";
import { hermesApiBody } from "@/lib/hermes-models";
import {
  createQueuedMessage,
  waitUntilAgentsIdle,
  type QueuedMessage,
} from "@/lib/message-queue";
import type { ChatbarAgentOption, ChatMessage, Conversation } from "@/lib/types";
import {
  dispatchFoundationDrafts,
  parseForgeDraftsFence,
  rememberStudioConversationId,
} from "@/lib/foundation-extract";
import {
  dispatchPlantApplied,
  type PlantApplyResult,
} from "@/lib/plant-apply";
import { ChatMarkdown } from "@/components/ui/ChatMarkdown";
import type { NormalizedHermesUsage } from "@/lib/chatbar/usage";
import { ChatbarApprovalModal } from "./ChatbarApprovalModal";
import { ChatbarComposer } from "./ChatbarComposer";
import { ChatbarContextChip } from "./ChatbarContextChip";
import { ChatbarDesktopBar } from "./ChatbarDesktopBar";
import { CollapsibleAgentView } from "./CollapsibleAgentView";
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
  /** Live snapshot — rendered collapsed under “What Hermes can see”. */
  agentView?: string;
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
    edgeOffset,
    edgeAlign,
    contextMode,
    setContextMode,
    pageRegistration,
    introRequestKey,
    pageModule,
    isProcessPinned,
    isAutomationPinned,
    composerFocusRequest,
    decisionSessionRequest,
  } = useChatbar();
  const processPin =
    isProcessPinned && pageModule?.pin?.type === "process"
      ? pageModule.pin
      : null;
  const automationPin =
    isAutomationPinned && pageModule?.pin?.type === "automation"
      ? pageModule.pin
      : null;
  const { isConnected, status, config, setModel } = useHermesConnection();
  const { openHermesConnection, currentBusiness } = useShell();

  const blurb = pageBlurbForPath(pathname);
  const conn = connectionLabel(isConnected, status.state);
  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const swapLabel = isLeft ? "Move chat to the right" : "Move chat to the left";

  const [conversations, setConversations] = useState<StudioListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [hiredAgents, setHiredAgents] = useState<ChatbarAgentOption[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  /** User-level Forge Overlord profileKey (for labels + BM lock). */
  const [overlordProfileKey, setOverlordProfileKey] = useState<string | null>(null);
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
  /** Hermes gated tool/command waiting on human decision. */
  const [pendingApproval, setPendingApproval] =
    useState<PendingRunApproval | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  /** Last Hermes-reported turn usage (prompt tokens) for dual-mode meter. */
  const [lastTurnUsage, setLastTurnUsage] = useState<NormalizedHermesUsage | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const lastIntroRequestKeyRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isDrainingQueueRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);
  /** Home → Foundation: avoid double replyOnly for the same pending seed */
  const pendingStudioReplySentRef = useRef<string | null>(null);
  const sendMessageNowRef = useRef<
    ((
      text: string,
      options?: { replyOnly?: boolean; route?: string },
    ) => Promise<void>) | null
  >(null);
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

  /** Ingest tool/runtime SSE payloads: tool strip + approval modal. */
  const ingestRuntimePayload = useCallback(
    (payload: Record<string, unknown>) => {
      setToolActivities((prev) =>
        pruneToolActivities(reduceToolActivities(prev, payload)),
      );
      const pending = parsePendingRunApproval(payload);
      if (pending) {
        setPendingApproval(pending);
        if (pending.runId) setActiveRunId(pending.runId);
        return;
      }
      if (isApprovalResolvedEvent(payload)) {
        setPendingApproval(null);
      }
    },
    [],
  );

  const respondToApproval = useCallback(
    async (choice: HermesApprovalChoice) => {
      const approval = pendingApproval;
      if (!approval) return;
      const runId = approval.runId || activeRunIdRef.current;
      if (!runId || !config?.baseUrl) {
        toast.error("Cannot submit approval", {
          description: "Missing active Hermes run or connection.",
        });
        return;
      }
      setApprovalSubmitting(true);
      try {
        await approveActiveRun({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          runId,
          choice,
        });
        setPendingApproval(null);
        toast.success(
          choice === "deny" ? "Denied — agent will continue" : "Approved",
          {
            description:
              choice === "deny"
                ? "Hermes was told not to run that action."
                : `Choice: ${choice}`,
          },
        );
      } catch (err) {
        toast.error("Approval failed", {
          description:
            err instanceof Error ? err.message : "Could not reach Hermes",
        });
      } finally {
        setApprovalSubmitting(false);
      }
    },
    [pendingApproval, config],
  );

  const businessId = currentBusiness?.id ?? null;
  const businessName = currentBusiness?.name ?? "this business";
  const overlordOnly = isChatbarOverlordOnlyPath(pathname);
  const overlordAgent =
    hiredAgents.find((a) => a.profileKey === overlordProfileKey) || null;
  /** Business Manager + Workshop lock to Overlord; other rooms list hired agents. */
  const pickerAgents = sortChatbarAgentsWithOverlordFirst(
    overlordOnly
      ? overlordAgent
        ? [overlordAgent]
        : []
      : hiredAgents,
    overlordProfileKey,
  );
  const activeAgent =
    hiredAgents.find((a) => a.id === activeAgentId) ||
    (overlordOnly ? overlordAgent : null) ||
    hiredAgents[0] ||
    null;
  const activeAgentLabel = activeAgent
    ? formatChatbarAgentLabel(activeAgent, overlordProfileKey)
    : null;

  const activeConversationTitle =
    conversations.find((c) => c.id === activeConversationId)?.title || null;
  const activeTitle = automationPin
    ? automationPin.label
    : processPin
      ? processPin.label
      : activeConversationTitle || "Studio chat";

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
    setPendingApproval(null);
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

  // First-visit intro (local, no API) when chat is open.
  // Stabilize deps: pageRegistration is often a new object each render from context.
  const registrationSnapshotKey = pageRegistration?.snapshotLines?.join("\n") ?? "";
  const registrationSelectionKey = pageRegistration?.selection?.summary ?? "";

  useEffect(() => {
    if (!isOpen || !businessId) {
      setIntroBanner((prev) => (prev == null ? prev : null));
      return;
    }

    const page = pageBlurbForPath(pathname);
    const force = introRequestKey > lastIntroRequestKeyRef.current;
    if (force) {
      lastIntroRequestKeyRef.current = introRequestKey;
      clearIntroSeen(businessId, page.routeKey);
    } else if (hasSeenIntro(businessId, page.routeKey)) {
      setIntroBanner((prev) => (prev == null ? prev : null));
      return;
    }

    const snapParts = [shellSnapshotText];
    if (registrationSnapshotKey) {
      snapParts.push(registrationSnapshotKey);
    }
    if (registrationSelectionKey) {
      snapParts.push(`Selection: ${registrationSelectionKey}`);
    }

    const intro = buildPageIntroCopy({
      businessName,
      page,
      snapshotText:
        contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY
          ? undefined
          : snapParts.filter(Boolean).join("\n"),
    });

    const next: IntroBanner = {
      routeKey: page.routeKey,
      title: `Welcome to ${page.title}`,
      body: intro.body,
      ...(intro.agentView ? { agentView: intro.agentView } : {}),
    };

    setIntroBanner((prev) => {
      if (
        prev &&
        prev.routeKey === next.routeKey &&
        prev.title === next.title &&
        prev.body === next.body &&
        prev.agentView === next.agentView
      ) {
        return prev;
      }
      return next;
    });
  }, [
    isOpen,
    businessId,
    businessName,
    pathname,
    shellSnapshotText,
    registrationSnapshotKey,
    registrationSelectionKey,
    contextMode,
    introRequestKey,
  ]);

  const dismissIntro = useCallback(() => {
    if (businessId && introBanner) {
      markIntroSeen(businessId, introBanner.routeKey);
    }
    setIntroBanner(null);
  }, [businessId, introBanner]);

  const loadConversationMessages = useCallback(
    async (
      conversationId: string,
      options?: { quiet?: boolean },
    ): Promise<boolean> => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/studio/conversations/${conversationId}`);
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          // Dev routing miss returns HTML 404; missing row returns JSON.
          if (contentType.includes("text/html")) {
            throw new Error(
              "Chat API route unavailable — restart desktop:dev if this persists",
            );
          }
          if (res.status === 404) {
            throw new Error("Conversation not found");
          }
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err.error === "string" ? err.error : "Failed to load messages",
          );
        }
        if (!contentType.includes("application/json")) {
          throw new Error("Failed to load messages (unexpected response)");
        }
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
        return true;
      } catch (error) {
        if (!options?.quiet) {
          toast.error(
            error instanceof Error ? error.message : "Could not load chat",
          );
        }
        setMessages([]);
        return false;
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  /** Task 6: load automation design messages for automation pin. */
  const loadAutomationScopedThread = useCallback(
    async (processId: string) => {
      if (!businessId || !processId) return;
      setLoadingList(true);
      setLoadingMessages(true);
      try {
        await fetch("/api/overlord/ensure-hired", { method: "POST" });
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
        const overlordRes = await fetch("/api/overlord");
        let overlordKey: string | null = null;
        if (overlordRes.ok) {
          const od = await overlordRes.json();
          overlordKey =
            typeof od.overlord?.profileKey === "string"
              ? od.overlord.profileKey
              : null;
        }
        setOverlordProfileKey(overlordKey);
        const overlordHired =
          (overlordKey && hired.find((a) => a.profileKey === overlordKey)) ||
          null;
        if (overlordHired) {
          setActiveAgentId(overlordHired.id);
          saveActiveChatbarAgentId(businessId, overlordHired.id);
        }

        const res = await fetch(`/api/processes/${processId}/automation`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load automation chat");
        }
        const data = await res.json();
        const autoId = data.automation?.id || processId;
        setConversations([
          {
            id: `automation:${autoId}`,
            title: "Automation design",
            kind: "process",
            businessId,
            processId,
            forkedFromId: null,
            hermesAgentProfileId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _count: {
              messages: data.automation?.messages?.length ?? 0,
            },
          } as unknown as StudioListItem,
        ]);
        setActiveConversationId(`automation:${autoId}`);
        setMessages(
          (data.automation?.messages || []).map(
            (m: ChatMessage & { createdAt?: string | Date }) => ({
              id: m.id,
              processId,
              conversationId: null,
              role: m.role,
              content: m.content,
              createdAt:
                typeof m.createdAt === "string"
                  ? m.createdAt
                  : m.createdAt
                    ? new Date(m.createdAt).toISOString()
                    : new Date().toISOString(),
            }),
          ),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load automation chat",
        );
        setConversations([]);
        setMessages([]);
      } finally {
        setLoadingList(false);
        setLoadingMessages(false);
      }
    },
    [businessId],
  );

  /** Task 5: load process-kind threads for Workshop pin (unified tree). */
  const loadProcessScopedThreads = useCallback(
    async (processId: string) => {
      if (!businessId || !processId) return;
      setLoadingList(true);
      try {
        await fetch("/api/overlord/ensure-hired", { method: "POST" });
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

        const overlordRes = await fetch("/api/overlord");
        let overlordKey: string | null = null;
        if (overlordRes.ok) {
          const od = await overlordRes.json();
          overlordKey =
            typeof od.overlord?.profileKey === "string"
              ? od.overlord.profileKey
              : null;
        }
        setOverlordProfileKey(overlordKey);
        const overlordHired =
          (overlordKey && hired.find((a) => a.profileKey === overlordKey)) ||
          null;
        if (overlordHired) {
          setActiveAgentId(overlordHired.id);
          saveActiveChatbarAgentId(businessId, overlordHired.id);
        }

        const res = await fetch(`/api/processes/${processId}/conversations`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load process chats");
        }
        const data = await res.json();
        let list: StudioListItem[] = (data.conversations || []).map(
          (c: StudioListItem & { kind?: string }) => ({
            ...c,
            kind: c.kind || "process",
            businessId: c.businessId || businessId,
            processId: c.processId || processId,
          }),
        );

        if (list.length === 0) {
          const createdRes = await fetch(
            `/api/processes/${processId}/conversations`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "Main" }),
            },
          );
          if (createdRes.ok) {
            const created = await createdRes.json();
            list = [
              {
                ...created,
                kind: "process",
                businessId,
                processId,
              },
            ];
          }
        }

        setConversations(list);
        const pick = list[0]?.id || null;
        setActiveConversationId(pick);
        if (pick) {
          await loadConversationMessages(pick);
        } else {
          setMessages([]);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not load process chat",
        );
        setConversations([]);
        setMessages([]);
      } finally {
        setLoadingList(false);
      }
    },
    [businessId, loadConversationMessages],
  );

  const loadConversations = useCallback(
    async (agentIdOverride?: string | null) => {
      // Always resolve Overlord identity for picker labels (even with no business yet)
      let overlordKey: string | null = null;
      let overlordDisplayName: string | null = null;
      try {
        const overlordRes = await fetch("/api/overlord");
        if (overlordRes.ok) {
          const overlordData = await overlordRes.json();
          overlordKey =
            typeof overlordData.overlord?.profileKey === "string"
              ? overlordData.overlord.profileKey
              : null;
          overlordDisplayName =
            typeof overlordData.overlord?.displayName === "string"
              ? overlordData.overlord.displayName
              : null;
        }
      } catch {
        /* non-fatal */
      }
      setOverlordProfileKey(overlordKey);

      if (!businessId) {
        setConversations([]);
        setActiveConversationId(null);
        // Synthetic Overlord option so BM can show the locked picker before a business exists
        if (overlordKey) {
          setHiredAgents([
            {
              id: "__overlord__",
              displayName: overlordDisplayName || overlordKey,
              profileKey: overlordKey,
            },
          ]);
          setActiveAgentId("__overlord__");
        } else {
          setHiredAgents([]);
          setActiveAgentId(null);
        }
        setMessages([]);
        return;
      }

      setLoadingList(true);
      try {

        // Always ensure Overlord is hired so it stays in the picker
        await fetch("/api/overlord/ensure-hired", { method: "POST" });

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

        const overlordHired =
          (overlordKey && hired.find((a) => a.profileKey === overlordKey)) || null;
        const lockToOverlord = isChatbarOverlordOnlyPath(pathname);
        const savedAgent = loadActiveChatbarAgentId(businessId);

        const pendingStudio = peekPendingStudioReply();
        const pendingForBusiness =
          pendingStudio?.businessId === businessId ? pendingStudio : null;

        let preferred: string | null = null;
        if (lockToOverlord && overlordHired) {
          preferred = overlordHired.id;
        } else if (
          pendingForBusiness?.hermesAgentProfileId &&
          hired.some((a) => a.id === pendingForBusiness.hermesAgentProfileId)
        ) {
          preferred = pendingForBusiness.hermesAgentProfileId;
        } else if (
          agentIdOverride &&
          agentIdOverride !== "__overlord__" &&
          hired.some((a) => a.id === agentIdOverride)
        ) {
          preferred = agentIdOverride;
        } else if (savedAgent && hired.some((a) => a.id === savedAgent)) {
          preferred = savedAgent;
        } else if (overlordHired) {
          preferred = overlordHired.id;
        } else {
          preferred = hired[0]?.id || null;
        }

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
        let list: StudioListItem[] = data.conversations || [];

        // Pending home brief may be agent-scoped differently than the filter;
        // ensure the seeded thread is selectable even if missing from the list payload.
        if (
          pendingForBusiness &&
          !list.some((c) => c.id === pendingForBusiness.conversationId)
        ) {
          try {
            const one = await fetch(
              `/api/studio/conversations/${pendingForBusiness.conversationId}`,
            );
            if (one.ok) {
              const detail = await one.json();
              if (detail?.id) {
                list = [
                  {
                    id: detail.id,
                    title: detail.title || "Studio chat",
                    kind: "studio",
                    businessId,
                    processId: null,
                    forkedFromId: detail.forkedFromId ?? null,
                    hermesAgentProfileId:
                      detail.hermesAgentProfileId ??
                      pendingForBusiness.hermesAgentProfileId ??
                      null,
                    createdAt: detail.createdAt,
                    updatedAt: detail.updatedAt,
                    _count: {
                      messages: Array.isArray(detail.messages)
                        ? detail.messages.length
                        : 1,
                    },
                  } as StudioListItem,
                  ...list,
                ];
              }
            }
          } catch {
            /* non-fatal — pick may still work via direct message load */
          }
        }

        setConversations(list);

        const saved = loadActiveStudioConversationId(businessId);
        // Only prefer pending when it exists in the list (verified above) —
        // never open a dead sessionStorage id that will 404.
        const pendingId =
          pendingForBusiness &&
          list.some((c) => c.id === pendingForBusiness.conversationId)
            ? pendingForBusiness.conversationId
            : null;
        if (pendingForBusiness && !pendingId) {
          consumePendingStudioReply();
        }

        const candidates = [
          pendingId,
          saved && list.find((c) => c.id === saved)?.id,
          list[0]?.id,
        ].filter((id): id is string => Boolean(id));

        // Dedupe while preserving order
        const uniqueCandidates = [...new Set(candidates)];

        let pick: string | null = null;
        for (const id of uniqueCandidates) {
          const ok = await loadConversationMessages(id, { quiet: true });
          if (ok) {
            pick = id;
            break;
          }
        }

        if (!pick) {
          setActiveConversationId(null);
          setMessages([]);
          if (businessId) clearActiveStudioConversationId(businessId);
          if (uniqueCandidates.length > 0) {
            toast.error("Could not load chat messages");
          }
        } else {
          setActiveConversationId(pick);
          saveActiveStudioConversationId(businessId, pick);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load studio chat");
      } finally {
        setLoadingList(false);
      }
    },
    [businessId, loadConversationMessages, pathname],
  );

  // Studio / process pin / automation pin (Tasks 5–6 unified tree)
  useEffect(() => {
    if (automationPin) {
      void loadAutomationScopedThread(automationPin.id);
      return;
    }
    if (processPin) {
      void loadProcessScopedThreads(processPin.id);
      return;
    }
    void loadConversations();
  }, [
    processPin?.id,
    automationPin?.id,
    loadConversations,
    loadProcessScopedThreads,
    loadAutomationScopedThread,
  ]);

  // Home Send opens chat after seeding; re-load so the pending studio thread is selected
  useEffect(() => {
    if (processPin || automationPin) return;
    if (!isOpen || !businessId) return;
    const pending = peekPendingStudioReply();
    if (!pending || pending.businessId !== businessId) return;
    if (activeConversationId === pending.conversationId && messages.some((m) => m.role === "user")) {
      return;
    }
    void loadConversations(pending.hermesAgentProfileId);
    // Only when dock opens or business changes — avoid loops on every message update
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open handoff
  }, [isOpen, businessId, processPin?.id, automationPin?.id]);

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

      // Prefer the agent's configured model when known; user can still
      // override via the separate Model dock control.
      const nextAgent = hiredAgents.find((a) => a.id === agentId);
      const preferred = nextAgent?.model?.trim();
      if (preferred) {
        setModel(preferred);
      }

      await loadConversations(agentId);
    },
    [
      businessId,
      activeAgentId,
      hiredAgents,
      loadConversations,
      clearMessageQueue,
      setModel,
    ],
  );

  // Business Manager + Workshop always lock the picker to Overlord
  useEffect(() => {
    if (!isChatbarOverlordOnlyPath(pathname)) return;
    if (!overlordAgent || !businessId) return;
    if (activeAgentId === overlordAgent.id) return;
    void selectAgent(overlordAgent.id);
  }, [pathname, overlordAgent, businessId, activeAgentId, selectAgent]);

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
      if (automationPin) {
        toast.message("Automation design uses a single design thread");
        return;
      }
      if (processPin) {
        const res = await fetch(
          `/api/processes/${processPin.id}/conversations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New chat" }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create chat");
        }
        const created = await res.json();
        const item = {
          ...created,
          kind: "process",
          businessId: businessId || "",
          processId: processPin.id,
        } as StudioListItem;
        setConversations((prev) => [item, ...prev]);
        await selectConversation(created.id);
        textareaRef.current?.focus();
        return;
      }

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
  }, [selectConversation, activeAgentId, processPin, automationPin, businessId]);

  const sendMessageNow = useCallback(
    async (text: string, options?: { replyOnly?: boolean; route?: string }) => {
      const replyOnly = options?.replyOnly === true;
      const sendRoute = options?.route || pathname;
      if (!replyOnly && !text.trim()) return;

      if (!isConnected || !config?.baseUrl || !config.apiKey) {
        openHermesConnection();
        toast.error("Connect to Hermes first");
        return;
      }

      // Task 6: automation design pin — dedicated API + SSE
      if (automationPin && !replyOnly) {
        const processId = automationPin.id;
        const controller = new AbortController();
        abortRef.current = controller;
        setSending(true);
        setToolActivities([]);
        setActiveRunId(null);
        setPendingApproval(null);

        const optimisticUser: ChatMessage = {
          id: `temp-user-${Date.now()}`,
          processId,
          conversationId: null,
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
            processId,
            conversationId: null,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
          },
        ]);
        setDraft("");

        try {
          const res = await fetch(
            `/api/processes/${processId}/automation/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: text,
                stream: true,
                ...hermesApiBody(config),
              }),
              signal: controller.signal,
            },
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Chat failed (${res.status})`);
          }
          if (!res.body) throw new Error("Empty stream");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamed = "";
          let doneStudio: unknown = null;
          let runExtraction = false;
          let cronLinked = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = parseSseBlocks(buffer);
            buffer = parsed.rest;
            for (const block of parsed.blocks) {
              if (block.event === "delta") {
                const payload = parseSseJson<{ text?: string }>(block.data);
                if (payload?.text) {
                  streamed += payload.text;
                  const snapshot = streamed;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === tempAssistantId
                        ? { ...m, content: snapshot }
                        : m,
                    ),
                  );
                }
              } else if (block.event === "usage") {
                const payload = parseSseJson<NormalizedHermesUsage>(block.data);
                if (payload && typeof payload.promptTokens === "number") {
                  setLastTurnUsage(payload);
                }
              } else if (block.event === "run_id") {
                const payload = parseSseJson<{ runId?: string }>(block.data);
                if (payload?.runId) setActiveRunId(payload.runId);
              } else if (
                block.event === "tool" ||
                block.event === "tool_activity"
              ) {
                const payload = parseSseJson<Record<string, unknown>>(
                  block.data,
                );
                if (payload) ingestRuntimePayload(payload);
              } else if (block.event === "done") {
                const payload = parseSseJson<{
                  message?: { content?: string };
                  runExtraction?: boolean;
                  cronLinked?: boolean;
                  automation?: { messages?: ChatMessage[] };
                  process?: unknown;
                }>(block.data);
                runExtraction = Boolean(payload?.runExtraction);
                cronLinked = Boolean(payload?.cronLinked);
                doneStudio = payload;
                if (payload?.automation?.messages) {
                  setMessages(
                    payload.automation.messages.map((m) => ({
                      id: m.id,
                      processId,
                      conversationId: null,
                      role: m.role,
                      content: m.content,
                      createdAt:
                        typeof m.createdAt === "string"
                          ? m.createdAt
                          : new Date().toISOString(),
                    })),
                  );
                } else if (payload?.message?.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === tempAssistantId
                        ? {
                            ...m,
                            id: `asst-${Date.now()}`,
                            content: payload.message!.content!,
                          }
                        : m.id === optimisticUser.id
                          ? m
                          : m,
                    ),
                  );
                }
              } else if (block.event === "error") {
                const payload = parseSseJson<{ error?: string }>(block.data);
                throw new Error(payload?.error || "Stream error");
              }
            }
          }

          pageModule?.onAutomationTurnComplete?.({
            processId,
            runExtraction,
            cronLinked,
            studio: doneStudio,
          });
          if (cronLinked) {
            toast.success("Detected existing Hermes cron job for this process");
          }
        } catch (error) {
          if ((error as Error)?.name === "AbortError") {
            toast.message("Stopped");
          } else {
            toast.error(
              error instanceof Error ? error.message : "Chat failed",
            );
            void loadAutomationScopedThread(processId);
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          setSending(false);
          setActiveRunId(null);
          textareaRef.current?.focus();
        }
        return;
      }

      if (!activeConversationId) {
        toast.error(
          processPin
            ? "No process conversation open"
            : "No studio conversation open",
        );
        return;
      }

      if (businessId && introBanner) {
        markIntroSeen(businessId, introBanner.routeKey);
        setIntroBanner(null);
      }

      const conversationId = activeConversationId;
      rememberStudioConversationId(conversationId);
      const firstVisit = businessId ? !hasSeenIntro(businessId, blurb.routeKey) : false;
      const controller = new AbortController();
      abortRef.current = controller;
      setSending(true);
      setToolActivities([]);
      setActiveRunId(null);
      setPendingApproval(null);

      const optimisticUser: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        processId: null,
        conversationId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      if (replyOnly) {
        // User message already seeded (Home → Foundation); only add assistant bubble
        setMessages((prev) => [
          ...prev,
          {
            id: tempAssistantId,
            processId: null,
            conversationId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
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
      }

      try {
        const res = await fetch(`/api/studio/conversations/${conversationId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(replyOnly ? { replyOnly: true } : { content: text }),
            route: sendRoute,
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
            } else if (block.event === "usage") {
              const payload = parseSseJson<NormalizedHermesUsage>(block.data);
              if (payload && typeof payload.promptTokens === "number") {
                setLastTurnUsage(payload);
              }
            } else if (block.event === "tool" || block.event === "tool_activity") {
              const payload = parseSseJson<Record<string, unknown>>(block.data);
              if (payload) ingestRuntimePayload(payload);
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
            } else if (block.event === "plant_apply") {
              const payload = parseSseJson<{
                result?: PlantApplyResult | null;
                summary?: string;
                error?: string;
                conversationId?: string;
                assistantMessageId?: string;
              }>(block.data);
              if (payload?.error) {
                toast.error("Plant apply failed", {
                  description: payload.error,
                });
              } else if (payload?.result?.applied) {
                const summary =
                  payload.summary || "Plant data applied from chat";
                rememberStudioConversationId(conversationId);
                dispatchPlantApplied({
                  result: payload.result,
                  conversationId,
                  assistantMessageId: payload.assistantMessageId,
                  summary,
                });
                if (payload.result.errors.length > 0) {
                  toast.message(summary, {
                    description: payload.result.errors.slice(0, 2).join("; "),
                  });
                } else {
                  toast.success(summary);
                }
              }
            } else if (block.event === "done") {
              const payload = parseSseJson<{
                message?: ChatMessage;
                title?: string;
                receipt?: ContextReceiptData;
                stopped?: boolean;
                runBackgroundAgents?: boolean;
                processId?: string;
                kind?: string;
                plantApply?: {
                  result?: PlantApplyResult;
                  summary?: string | null;
                };
              }>(block.data);
              if (payload?.stopped) stopped = true;
              if (payload?.message) {
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === tempAssistantId || m.id === payload.message!.id
                      ? {
                          ...payload.message!,
                          processId: payload.message!.processId ?? null,
                        }
                      : m,
                  );
                  pageModule?.onMessagesSynced?.(next);
                  return next;
                });
                if (
                  payload.runBackgroundAgents &&
                  (payload.processId || processPin?.id)
                ) {
                  pageModule?.onProcessTurnComplete?.({
                    processId: payload.processId || processPin!.id,
                    runBackgroundAgents: true,
                    conversationId,
                  });
                }
                // Fallback: if server did not auto-apply (e.g. chat-only mode),
                // still offer Foundation review for forge-drafts fences.
                const assistantText = payload.message.content || streamed;
                const alreadyApplied = Boolean(
                  payload.plantApply?.result?.applied &&
                    ((payload.plantApply.result.drafts?.createdCount ?? 0) > 0 ||
                      (payload.plantApply.result.drafts?.updatedCount ?? 0) > 0),
                );
                if (
                  (sendRoute.startsWith("/foundation") ||
                    pathname.startsWith("/foundation")) &&
                  !payload.stopped &&
                  assistantText &&
                  !alreadyApplied
                ) {
                  const drafts = parseForgeDraftsFence(assistantText);
                  if (drafts.length > 0) {
                    rememberStudioConversationId(conversationId);
                    dispatchFoundationDrafts({
                      drafts,
                      conversationId,
                      assistantMessageId: payload.message.id,
                    });
                    toast.message(
                      `${drafts.length} draft process${drafts.length === 1 ? "" : "es"} proposed`,
                      {
                        description:
                          "Review and seed them on the Foundation canvas.",
                      },
                    );
                  }
                }
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
            return prev.filter((m) => {
              if (m.id === tempAssistantId) return false;
              // replyOnly: real user message stays; only drop optimistic user on normal send
              if (!replyOnly && m.id === optimisticUser.id) return false;
              return true;
            });
          });
          toast.message("Stopped");
        } else {
          toast.error(error instanceof Error ? error.message : "Chat failed");
          setMessages((prev) =>
            prev.filter((m) => {
              if (m.id === tempAssistantId) return false;
              if (!replyOnly && m.id === optimisticUser.id) return false;
              return true;
            }),
          );
          if (!replyOnly) {
            setDraft((current) => (current.trim() ? current : text));
          }
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
      processPin,
      automationPin,
      pageModule,
      loadAutomationScopedThread,
    ],
  );

  sendMessageNowRef.current = sendMessageNow;

  /**
   * Home Send seeds a studio user message + pending flag, navigates to Foundation,
   * and opens the chatbar. When the thread is ready, stream Hermes replyOnly.
   */
  useEffect(() => {
    if (!businessId || loadingList || loadingMessages || sending) return;
    if (!isConnected || !config?.baseUrl || !config.apiKey) return;
    if (isProcessPinned || isAutomationPinned) return;

    const pending = peekPendingStudioReply();
    if (!pending || pending.businessId !== businessId) return;
    if (activeConversationId !== pending.conversationId) return;
    if (pendingStudioReplySentRef.current === pending.conversationId) return;

    const last = messages.at(-1);
    if (!last || last.role !== "user") {
      // Stale or already answered — drop the one-shot flag
      consumePendingStudioReply();
      return;
    }

    const sender = sendMessageNowRef.current;
    if (!sender) return;

    pendingStudioReplySentRef.current = pending.conversationId;
    consumePendingStudioReply();
    // Force Foundation plant-sketch prompt even if nav is still mid-flight
    void sender(last.content, { replyOnly: true, route: "/foundation" });
  }, [
    businessId,
    loadingList,
    loadingMessages,
    sending,
    isConnected,
    config,
    isProcessPinned,
    isAutomationPinned,
    activeConversationId,
    messages,
  ]);

  // Prefill / focus studio composer (decision redirect, open tab, Alt+H, focusComposer)
  useEffect(() => {
    if (!composerFocusRequest) return;
    if (composerFocusRequest.prefill) {
      setDraft(composerFocusRequest.prefill);
    }
    // Short delay so expand-from-collapsed (width:0) can paint before focus.
    const id = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [composerFocusRequest?.key]);

  const handleComposerSubmit = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? draft).trim();
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
        setDraft("");
        return;
      }

      // send
      setDraft("");
      void sendMessageNow(text);
    },
    [draft, sending, canSteer, enqueueDraft, sendMessageNow, steerCurrentDraft],
  );

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

  const busyLabel = sending
    ? "Hermes is thinking — new messages will queue"
    : null;

  return (
    <>
    <ChatbarApprovalModal
      approval={pendingApproval}
      submitting={approvalSubmitting}
      onDecide={(choice) => void respondToApproval(choice)}
      onDismiss={() => {
        if (!approvalSubmitting) setPendingApproval(null);
      }}
    />
    <aside
      className={`chatbar-panel chatbar-panel--side-${isLeft ? "left" : "right"}${isOpen ? " is-open" : " is-collapsed"}`}
      aria-label="Hermes chat"
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
    >
      <header className="chatbar-panel__header">
        <div className="chatbar-panel__edge-controls">
          <button
            type="button"
            className="chatbar-panel__icon-btn chatbar-panel__collapse-btn"
            onClick={collapse}
            title="Hide chat (Alt+H)"
            aria-label="Hide chat"
          >
            <CollapseIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="chatbar-panel__icon-btn chatbar-panel__swap-btn"
            onClick={swapSide}
            title={swapLabel}
            aria-label={swapLabel}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>
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
            <span
              className="chatbar-panel__session-title"
              title={
                automationPin
                  ? `Automation · ${automationPin.label}`
                  : processPin && activeConversationTitle
                    ? `${processPin.label} · ${activeConversationTitle}`
                    : activeTitle
              }
            >
              {activeTitle}
            </span>
            {automationPin && pageModule?.statusLabel ? (
              <span className="chatbar-panel__pill chatbar-panel__pill--warn" role="status">
                {pageModule.statusLabel}
              </span>
            ) : null}
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
          pageRegistration?.selection?.summary &&
          pageRegistration.selection.type !== "plant" ? (
            <div
              className="chatbar-panel__selection-row"
              role="status"
              title="Included in Hermes context for this chat"
            >
              <span
                className={`chatbar-panel__selection-pill${
                  pageRegistration.selection.type === "process"
                    ? " chatbar-panel__selection-pill--process"
                    : ""
                }`}
              >
                {pageRegistration.selection.type === "process" ? (
                  <Hammer className="w-3 h-3 shrink-0" aria-hidden />
                ) : (
                  <Crosshair className="w-3 h-3 shrink-0" aria-hidden />
                )}
                <span className="chatbar-panel__selection-pill-label">
                  {pageRegistration.selection.type === "process"
                    ? "Process"
                    : "Selection"}
                </span>
                <span className="chatbar-panel__selection-pill-value">
                  {pageRegistration.selection.summary}
                </span>
              </span>
              <span className="chatbar-panel__selection-hint">
                In agent context
              </span>
            </div>
          ) : null}
        </section>

        <section className="chatbar-panel__messages" aria-live="polite">
          {introBanner ? (
            <div className="chatbar-panel__intro" role="status">
              <div className="chatbar-panel__intro-head">
                <Info className="w-3.5 h-3.5" aria-hidden />
                <strong>{introBanner.title}</strong>
              </div>
              <div className="chatbar-panel__intro-body">
                <ChatMarkdown markdown={introBanner.body} />
              </div>
              {introBanner.agentView ? (
                <CollapsibleAgentView text={introBanner.agentView} />
              ) : null}
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
                {activeAgentLabel ? (
                  <>
                    {" "}
                    · talking to <strong>{activeAgentLabel}</strong>
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
                <div
                  className={`chatbar-panel__message-content${
                    !isUser ? " chatbar-panel__message-content--md" : ""
                  }`}
                >
                  {isStreamingEmpty ? (
                    <span className="chatbar-panel__thinking">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                    </span>
                  ) : isUser ? (
                    message.content
                  ) : (
                    <ChatMarkdown markdown={message.content} />
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
          <ChatbarComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleComposerSubmit}
            disabled={!businessId}
            textareaRef={textareaRef}
            composerState={composerState}
            sending={sending}
            canSteer={canSteer}
            isLoading={sending}
            willQueue={Boolean(busyLabel && draft.trim())}
            onStop={stopCurrentTurn}
            onSteer={() => void steerCurrentDraft()}
            onQueue={() => {
              if (draft.trim()) enqueueDraft(draft);
            }}
            enableRichTokens={Boolean(processPin)}
            mentionables={
              processPin && pageModule?.mentionables
                ? [...pageModule.mentionables]
                : undefined
            }
            onSlashCommand={
              processPin ? pageModule?.onSlashCommand : undefined
            }
            selectedNode={
              processPin &&
              pageModule?.composerChrome?.kind === "node-target"
                ? { label: pageModule.composerChrome.label }
                : null
            }
            onClearNode={
              processPin &&
              pageModule?.composerChrome?.kind === "node-target"
                ? pageModule.composerChrome.onClear
                : undefined
            }
            placeholder={
              !businessId
                ? "Select a business to start chatting…"
                : !isConnected
                  ? "Connect Hermes, then ask about this page…"
                  : automationPin
                    ? "Describe what to automate, schedule, tools…"
                    : processPin
                      ? "Describe steps, actors, tools… try / or @"
                      : sending
                        ? "Type to queue a follow-up while Hermes replies…"
                        : contextMode === CHATBAR_CONTEXT_MODES.CHAT_ONLY
                          ? "Chat only — no page snapshot…"
                          : "Ask about this page or your business…"
            }
            ariaLabel={
              automationPin
                ? `Design automation for ${automationPin.label}`
                : processPin
                  ? `Message Overlord about ${processPin.label}`
                  : activeAgentLabel
                    ? `Message ${activeAgentLabel}`
                    : "Message Hermes"
            }
            selectionPills={
              contextMode !== CHATBAR_CONTEXT_MODES.CHAT_ONLY &&
              pageRegistration?.selection?.summary ? (
                <span
                  className={`chatbar-panel__selection-pill chatbar-panel__selection-pill--compact${
                    pageRegistration.selection.type === "process"
                      ? " chatbar-panel__selection-pill--process"
                      : ""
                  }`}
                >
                  {pageRegistration.selection.type === "process" ? (
                    <Hammer className="w-3 h-3 shrink-0" aria-hidden />
                  ) : (
                    <Crosshair className="w-3 h-3 shrink-0" aria-hidden />
                  )}
                  <span className="chatbar-panel__selection-pill-value">
                    {pageRegistration.selection.summary}
                  </span>
                </span>
              ) : null
            }
          />
          <ChatbarDesktopBar
            showModel={false}
            meterInput={{
              messages,
              draftText: draft,
              lastTurnPromptTokens: lastTurnUsage?.promptTokens ?? null,
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
              edgeAlign,
              edgeOffset,
              isProcessScoped: false,
              conversationId: activeConversationId,
              messageCount: messages.length,
            }}
            disabled={!businessId}
            agentPicker={{
              agents: pickerAgents,
              activeAgentId,
              overlordProfileKey,
              loading: loadingList,
              overlordOnly,
              disabled: sending || !businessId,
              onSelectAgent: (id) => void selectAgent(id),
            }}
          />
          <div className="chatbar-panel__bottom-row">
            <button
              type="button"
              className="chatbar-panel__icon-btn chatbar-panel__collapse-btn"
              onClick={collapse}
              title="Hide chat (Alt+H)"
              aria-label="Hide chat"
            >
              <CollapseIcon className="w-4 h-4" />
            </button>
            <div className="chatbar-panel__bottom-row-end">
              <ChatbarContextChip
                mode={contextMode}
                onChange={setContextMode}
                pageTitle={blurb.title}
                disabled={false}
              />
            </div>
          </div>
        </div>
      </footer>
    </aside>
    </>
  );
}
