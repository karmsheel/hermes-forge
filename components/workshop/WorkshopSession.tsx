"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast as sonnerToast } from "sonner";
import { Activity, CheckCircle2, Scissors, Unlock, Zap } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { canApproveForAutomation, PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { serializeNodeCommentSummary } from "@/lib/node-comment";
import { WorkshopPageContext } from "@/components/chatbar/page-providers/WorkshopPageContext";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { ProcessSidebar } from "@/components/workshop/ProcessSidebar";
import { MermaidDiagram, type MermaidNodeInfo } from "@/components/workshop/MermaidDiagram";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/workshop/WorkspaceTabs";
import { DetailsPanel } from "@/components/workshop/DetailsPanel";
import { SourcePanel } from "@/components/workshop/SourcePanel";
import { QuestionsPanel } from "@/components/workshop/QuestionsPanel";
import { ExportMenu } from "@/components/export/ExportMenu";
import { SplitProcessDialog } from "@/components/workshop/SplitProcessDialog";
import type { ProcessSessionBinding } from "@/lib/chatbar/process-session";
import { consumeDiagramStream } from "@/lib/diagram-sse-client";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { analyzeSplitCandidates } from "@/lib/mermaid-graph";
import {
  aggregateFunctions,
  filterProcessesByFunctionKeepingActive,
} from "@/lib/functions";
import {
  clearActiveProcessId,
  consumePendingHermesReply,
  consumePendingNewProcess,
  getActiveFunctionFilter,
  getActiveProcessId,
  setActiveFunctionFilter,
  setActiveProcessId,
  getActiveConversationId,
  setActiveConversationId as persistConversationId,
} from "@/lib/workshop-storage";
import type { ProcessSummary, ProcessWithMessages, ChatMessage } from "@/lib/types";
import { buildNodeCommentPrefix } from "@/lib/node-comment";
import {
  createQueuedMessage,
  waitUntilAgentsIdle,
  type QueuedMessage,
} from "@/lib/message-queue";
import {
  buildPersonnelRoster,
  personnelToMentionables,
  type PersonnelRoster,
} from "@/lib/personnel/context";
import {
  extractSystemsFromFields,
  systemsToMentionables,
} from "@/lib/systems";
import type { Mentionable } from "@/components/workshop/rich-composer/parse";
import { forgeFetch } from "@/lib/forge-fetch";

export type WorkshopSessionMeta = {
  processId?: string | null;
  processName?: string | null;
  workspaceTab?: WorkspaceTab;
};

export type WorkshopSessionProps = {
  /** Stable id when multi-mounted under desktop tabs (4.15). */
  tabId?: string;
  businessId: string;
  /** Prefer this process on first load (tab snapshot). */
  initialProcessId?: string | null;
  initialWorkspaceTab?: WorkspaceTab;
  /**
   * When false (background multi-tab mount), keep streams/state alive but do not
   * own the global chatbar binding or new-process rail handler.
   */
  isActive?: boolean;
  onMetaChange?: (meta: WorkshopSessionMeta) => void;
};

/**
 * Workshop process mapping session. Desktop multi-tab (4.15) mounts one instance
 * per workshop tab; web uses a single active instance via the workshop page.
 */
export function WorkshopSession({
  tabId: _tabId,
  businessId: scopedBusinessId,
  initialProcessId = null,
  initialWorkspaceTab,
  isActive = true,
  onMetaChange,
}: WorkshopSessionProps) {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [activeProcess, setActiveProcess] = useState<ProcessWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialProcessId ?? null);
  const businessId = scopedBusinessId;
  const [functionFilter, setFunctionFilter] = useState<string | null>(null);
  /** 4.10 — roster for @-mentions (actors + roles) */
  const [personnelRoster, setPersonnelRoster] = useState<PersonnelRoster | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentsRunning, setAgentsRunning] = useState(false);
  const [diagramStreaming, setDiagramStreaming] = useState(false);
  const [streamingDiagram, setStreamingDiagram] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);
    const [unforging, setUnforging] = useState(false);
    const [composerFocusKey, setComposerFocusKey] = useState(0);
    // 3.2 Node-level comments
    const [selectedNode, setSelectedNode] = useState<MermaidNodeInfo | null>(null);
    // 3.5: nodes from the rendered diagram, surfaced as @-mention candidates
    // in the rich composer. Refreshed on every diagram (re-)render.
    const [diagramNodes, setDiagramNodes] = useState<MermaidNodeInfo[]>([]);
    // 3.2: per-node user comment summary, derived from chat history and
    // passed to the diagram so it can render the comment dots.
    const [commentedNodes, setCommentedNodes] = useState<
      Map<string, { count: number; firstLabel: string }>
    >(new Map());
    // 3.2: when the user clicks a comment dot on the diagram, we bump this
    // so the chat scrolls to the first matching message.
    const [chatScrollRequest, setChatScrollRequest] = useState<{ key: number; label: string | null } | null>(null);
    // 3.6 Workspace tabs
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(
      initialWorkspaceTab ?? "diagram",
    );
    // Diagram split: multi-flow → two processes
    const [splitDialogOpen, setSplitDialogOpen] = useState(false);
    const [splitInstruction, setSplitInstruction] = useState("");
    // 3.4 Conversation fork
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const activeConversationIdRef = useRef<string | null>(null);
  const {
    openHermesConnection,
    registerWorkshopNewProcess,
    registerWorkshopRefresh,
  } = useShell();
  const { config: hermesConfig } = useHermesConnection();
  const { registerProcessSession, open: openChatbar, focusComposer } = useChatbar();
  // Only the initially active session consumes one-shot pending flags
  const pendingReplyProcessIdRef = useRef<string | null>(
    isActive ? consumePendingHermesReply() : null,
  );
  const pendingReplySentRef = useRef(false);
  const pendingCreateRef = useRef(isActive ? consumePendingNewProcess() : false);
  const activeIdRef = useRef(activeId);
  const onMetaChangeRef = useRef(onMetaChange);
  onMetaChangeRef.current = onMetaChange;
  const scopedBusinessIdRef = useRef(scopedBusinessId);
  scopedBusinessIdRef.current = scopedBusinessId;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Mute toasts from background multi-tab sessions (4.15 Phase 3)
  const toast = useMemo(
    () => ({
      success: (message: string, data?: Parameters<typeof sonnerToast.success>[1]) => {
        if (isActiveRef.current) sonnerToast.success(message, data);
      },
      error: (message: string, data?: Parameters<typeof sonnerToast.error>[1]) => {
        if (isActiveRef.current) sonnerToast.error(message, data);
      },
      warning: (message: string, data?: Parameters<typeof sonnerToast.warning>[1]) => {
        if (isActiveRef.current) sonnerToast.warning(message, data);
      },
      info: (message: string, data?: Parameters<typeof sonnerToast.info>[1]) => {
        if (isActiveRef.current) sonnerToast.info(message, data);
      },
    }),
    [],
  );

  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) =>
      forgeFetch(input, { ...init, businessId: scopedBusinessIdRef.current }),
    [],
  );
  const hermesConfigRef = useRef(hermesConfig);
  const sendMessageRef = useRef<((content: string, options?: { replyOnly?: boolean }) => any) | null>(null);
  const selectedNodeRef = useRef<MermaidNodeInfo | null>(null);
  // 3.7 Queued messages while agents run
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isDrainingQueueRef = useRef(false);
  const chatLoadingRef = useRef(chatLoading);
  const agentsRunningRef = useRef(agentsRunning);

  useEffect(() => {
    hermesConfigRef.current = hermesConfig;
  }, [hermesConfig]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    chatLoadingRef.current = chatLoading;
  }, [chatLoading]);

  useEffect(() => {
    agentsRunningRef.current = agentsRunning;
  }, [agentsRunning]);

  // 4.10 — load humans + hired agents for this session's business
  useEffect(() => {
    if (!scopedBusinessId) {
      setPersonnelRoster(null);
      return;
    }
    let cancelled = false;
    async function loadRoster() {
      try {
        const [humansRes, agentsRes] = await Promise.all([
          apiFetch("/api/personnel/humans"),
          apiFetch("/api/personnel/agents"),
        ]);
        if (!humansRes.ok || !agentsRes.ok) return;
        const humansData = await humansRes.json();
        const agentsData = await agentsRes.json();
        if (cancelled) return;
        setPersonnelRoster(
          buildPersonnelRoster({
            humans: humansData.humans ?? [],
            agents: agentsData.hired ?? agentsData.agents?.filter((a: { isHired?: boolean }) => a.isHired) ?? [],
          }),
        );
      } catch {
        if (!cancelled) setPersonnelRoster(null);
      }
    }
    void loadRoster();
    return () => {
      cancelled = true;
    };
  }, [scopedBusinessId, apiFetch]);

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

  const enqueueChatMessage = useCallback(
    (content: string, options?: { nodeContext?: { nodeId?: string; label: string } }) => {
      messageQueueRef.current = [
        ...messageQueueRef.current,
        createQueuedMessage(content, options),
      ];
      syncQueuedMessages();
    },
    [syncQueuedMessages],
  );

  const loadProcessList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiFetch("/api/processes");
      if (res.status === 401) {
        // Never hard-redirect from workshop — multi-tab background sessions and
        // racey session cookies were thrashing foundation ↔ workshop ↔ functions.
        setProcesses([]);
        setActiveProcess(null);
        setActiveId(null);
        if (isActiveRef.current) {
          toast.error("Session expired — sign in again to map processes.");
        }
        return;
      }
      const data = await res.json();
      if (!data.business) {
        // Empty state only — do not window.location to /functions (full reload
        // re-seeded desktop tabs and fought the current route).
        setProcesses([]);
        setActiveProcess(null);
        setActiveId(null);
        return;
      }

      const list: ProcessSummary[] = data.processes || [];
      const currentBusinessId: string = data.business.id || scopedBusinessId;

      setProcesses(list);

      const savedFunctionFilter = getActiveFunctionFilter(currentBusinessId);
      const availableFunctions = aggregateFunctions(list);
      const resolvedFunctionFilter =
        savedFunctionFilter &&
        availableFunctions.some((fn) => fn.name === savedFunctionFilter)
          ? savedFunctionFilter
          : null;
      setFunctionFilter(resolvedFunctionFilter);
      if (savedFunctionFilter && !resolvedFunctionFilter) {
        setActiveFunctionFilter(currentBusinessId, null);
      }

      const savedProcessId = getActiveProcessId(currentBusinessId);
      const preferredId =
        initialProcessId && list.some((p) => p.id === initialProcessId)
          ? initialProcessId
          : savedProcessId && list.some((p) => p.id === savedProcessId)
            ? savedProcessId
            : null;

      setActiveId((currentId) => {
        // Keep an already-selected process if it still exists in this business
        const next =
          currentId && list.some((p) => p.id === currentId)
            ? currentId
            : preferredId;
        activeIdRef.current = next;
        return next;
      });

      setActiveProcess((prev) => {
        if (!prev) return prev;
        return list.some((p) => p.id === prev.id) ? prev : null;
      });

      if (
        savedProcessId &&
        !list.some((p) => p.id === savedProcessId) &&
        !(initialProcessId && list.some((p) => p.id === initialProcessId))
      ) {
        clearActiveProcessId(currentBusinessId);
      }
    } catch {
      toast.error("Failed to load processes");
    } finally {
      setLoadingList(false);
    }
  }, [apiFetch, scopedBusinessId, initialProcessId]);

  const loadProcess = useCallback(async (id: string, projectId: string) => {
    setLoadingProcess(true);
    try {
      const res = await apiFetch(`/api/processes/${id}`);
      if (!res.ok) throw new Error("Process not found");
      const process: ProcessWithMessages = await res.json();
      setActiveProcess(process);
      setActiveId(id);
      activeIdRef.current = id; // sync immediately so replyOnly / handle calls see fresh id
      // Avoid background multi-tab sessions clobbering shared localStorage selection
      if (isActiveRef.current) {
        setActiveProcessId(projectId, id);
      }
      onMetaChangeRef.current?.({
        processId: id,
        processName: process.name,
      });

      // 3.4: Set active conversation (from storage or first conversation)
      const savedConvId = getActiveConversationId(id);
      const convId =
        savedConvId && process.conversations?.some((c) => c.id === savedConvId)
          ? savedConvId
          : process.conversations?.[0]?.id ?? null;
      setActiveConversationId(convId);
      activeConversationIdRef.current = convId;
      if (convId) persistConversationId(id, convId);

      if (pendingReplyProcessIdRef.current === id && !pendingReplySentRef.current) {
        setComposerFocusKey((k) => k + 1);
      }
    } catch {
      toast.error("Failed to load process");
      setActiveId(null);
      setActiveProcess(null);
      clearActiveProcessId(projectId);
    } finally {
      setLoadingProcess(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadProcessList();
  }, [loadProcessList, scopedBusinessId]);

  useEffect(() => {
    if (activeId && businessId && !loadingList) {
      loadProcess(activeId, businessId);
    }
  }, [activeId, businessId, loadingList, loadProcess]);

  const availableFunctions = useMemo(() => aggregateFunctions(processes), [processes]);

  const filteredProcesses = useMemo(
    () => filterProcessesByFunctionKeepingActive(processes, functionFilter, activeId),
    [processes, functionFilter, activeId],
  );

  const handleFunctionFilterChange = useCallback((functionName: string | null) => {
    setFunctionFilter(functionName);
    if (businessId) setActiveFunctionFilter(businessId, functionName);
  }, [businessId]);

  const handleCreateProcess = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Process" }),
      });
      if (!res.ok) throw new Error("Create failed");
      const process: ProcessWithMessages = await res.json();
      setActiveProcess(process);
      setActiveId(process.id);
      activeIdRef.current = process.id;
      setSelectedNode(null);
      setActiveTab("diagram");
      if (businessId && isActiveRef.current) setActiveProcessId(businessId, process.id);
      onMetaChangeRef.current?.({
        processId: process.id,
        processName: process.name,
        workspaceTab: "diagram",
      });
      await loadProcessList();
      setComposerFocusKey((k) => k + 1);
      toast.success("New process started");
    } catch {
      toast.error("Failed to create process");
    } finally {
      setCreating(false);
    }
  }, [apiFetch, businessId, creating, loadProcessList]);

  useEffect(() => {
    if (!isActive) {
      registerWorkshopNewProcess(null);
      return;
    }
    registerWorkshopNewProcess(handleCreateProcess);
    return () => registerWorkshopNewProcess(null);
  }, [isActive, handleCreateProcess, registerWorkshopNewProcess]);

  const handleWorkshopRefresh = useCallback(() => {
    void loadProcessList();
    if (activeId && businessId) void loadProcess(activeId, businessId);
  }, [activeId, businessId, loadProcess, loadProcessList]);

  useEffect(() => {
    if (!isActive) {
      registerWorkshopRefresh(null);
      return;
    }
    registerWorkshopRefresh(handleWorkshopRefresh);
    return () => registerWorkshopRefresh(null);
  }, [isActive, handleWorkshopRefresh, registerWorkshopRefresh]);

  useEffect(() => {
    if (!pendingCreateRef.current) return;
    if (!businessId || loadingList || creating) return;
    pendingCreateRef.current = false;
    void handleCreateProcess();
  }, [businessId, loadingList, creating, handleCreateProcess]);

  function handleSelectProcess(id: string) {
    if (id === activeId) return;
    setStreamingDiagram(null);
    setDiagramStreaming(false);
    setSelectedNode(null);
    setActiveTab("diagram");
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    messageQueueRef.current = [];
    setQueuedMessages([]);
    setActiveId(id);
    activeIdRef.current = id; // keep ref in sync for any pending sends
    const name = processes.find((p) => p.id === id)?.name ?? null;
    onMetaChangeRef.current?.({
      processId: id,
      processName: name,
      workspaceTab: "diagram",
    });
  }

  const runBackgroundAgents = useCallback(
    async (processId: string) => {
      if (!hermesConfig) return;
      setAgentsRunning(true);
      setDiagramStreaming(true);
      setStreamingDiagram(null);

      const agentBody = JSON.stringify({
        ...hermesApiBody(hermesConfig),
        stream: true,
        ...(activeConversationIdRef.current ? { conversationId: activeConversationIdRef.current } : {}),
      });
      const agentHeaders = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };

      try {
        const [diagramResult, nameResult] = await Promise.allSettled([
          consumeDiagramStream(
            await apiFetch(`/api/processes/${processId}/diagram`, {
              method: "POST",
              headers: agentHeaders,
              body: agentBody,
            }),
            {
              onPreview: (mermaid) => {
                setStreamingDiagram(mermaid);
              },
              onDone: (mermaid) => {
                setStreamingDiagram(mermaid);
                setActiveProcess((prev) =>
                  prev && prev.id === processId
                    ? {
                        ...prev,
                        diagramMermaid: mermaid,
                        diagramUpdatedAt: new Date().toISOString(),
                      }
                    : prev
                );
              },
              onDecisionPending: ({ message }) => {
                setStreamingDiagram(null);
                toast.info(message || "Diagram change needs your approval — check Decisions or the bell");
              },
            }
          ),
          apiFetch(`/api/processes/${processId}/suggest-name`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hermesApiBody(hermesConfig)),
          }),
        ]);

        if (diagramResult.status === "rejected") {
          toast.warning("Diagram subagent failed");
        } else if (!diagramResult.value.ok) {
          toast.warning(diagramResult.value.error || "Diagram could not be updated");
        } else if (diagramResult.value.decisionPending) {
          // Toast already shown in onDecisionPending
        }

        if (nameResult.status === "fulfilled" && nameResult.value.ok) {
          const nameData = await nameResult.value.json();
          if (nameData.updated && nameData.process) {
            setActiveProcess(nameData.process);
            onMetaChangeRef.current?.({
              processId: processId,
              processName: nameData.name ?? nameData.process.name,
            });
            toast.success(`Named workflow: ${nameData.name}`);
          }
        }

        if (businessId) await loadProcess(processId, businessId);
        await loadProcessList();
      } finally {
        setDiagramStreaming(false);
        setStreamingDiagram(null);
        setAgentsRunning(false);
      }
    },
    [apiFetch, businessId, hermesConfig, loadProcess, loadProcessList]
  );

  async function handleApproveForAutomation() {
    if (!activeId || !activeProcess) return;
    setApproving(true);
    try {
      const res = await apiFetch(`/api/processes/${activeId}/forge`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Forge failed");
      }
      const data = await res.json();
      const updated = data.process ?? data;
      setActiveProcess((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadProcessList();
      toast.success("Process forged — locked as live business documentation");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not forge process");
    } finally {
      setApproving(false);
    }
  }

  async function handleUnforgeProcess() {
    if (!activeId || !activeProcess) return;
    const ok = window.confirm(
      "Reopen this process as draft? Agents can edit the map again."
    );
    if (!ok) return;
    setUnforging(true);
    try {
      const res = await apiFetch(`/api/processes/${activeId}/unforge`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unforge failed");
      }
      const data = await res.json();
      const updated = data.process ?? data;
      setActiveProcess((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadProcessList();
      toast.success("Process reopened as draft");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not unforge process"
      );
    } finally {
      setUnforging(false);
    }
  }

  async function handleRenameProcess(id: string, name: string) {
    const res = await apiFetch(`/api/processes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Rename failed");
    const updated = await res.json();
    if (activeId === id) {
      setActiveProcess((prev) => (prev ? { ...prev, name: updated.name, nameStatus: "confirmed" } : prev));
      onMetaChangeRef.current?.({ processId: id, processName: updated.name });
    }
    await loadProcessList();
    toast.success("Workflow renamed");
  }

  async function handleDeleteProcess(id: string) {
    const res = await apiFetch(`/api/processes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Delete failed");
    }

    const wasActive = activeId === id;
    if (businessId && (wasActive || getActiveProcessId(businessId) === id)) {
      clearActiveProcessId(businessId);
    }

    if (wasActive) {
      setActiveProcess(null);
      setActiveId(null);
      activeIdRef.current = null;
      setSelectedNode(null);
      setStreamingDiagram(null);
      setDiagramStreaming(false);
      setActiveConversationId(null);
      activeConversationIdRef.current = null;
      messageQueueRef.current = [];
      setQueuedMessages([]);
    }

    setLoadingList(true);
    try {
      const listRes = await apiFetch("/api/processes");
      if (!listRes.ok) throw new Error("Failed to refresh workflows");
      const data = await listRes.json();
      const list: ProcessSummary[] = data.processes || [];
      setProcesses(list);

      if (wasActive) {
        if (list.length > 0 && businessId) {
          const nextId = list[0].id;
          setActiveId(nextId);
          activeIdRef.current = nextId;
          setActiveProcessId(businessId, nextId);
          onMetaChangeRef.current?.({
            processId: nextId,
            processName: list[0].name,
          });
        } else {
          onMetaChangeRef.current?.({ processId: null, processName: null });
        }
      }
    } finally {
      setLoadingList(false);
    }

    toast.success("Workflow deleted");
  }

  // 3.2: User clicked a node in the diagram — target it for correction
  const handleNodeClick = useCallback((node: MermaidNodeInfo) => {
    setSelectedNode(node);
    // Focus the chat composer so the user can immediately type the correction
    setComposerFocusKey((k) => k + 1);
  }, []);

  const clearSelectedNode = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // 3.2: clicking a comment dot on the diagram asks the chat to scroll to
  // the first message targeting that node. The chat handles the actual
  // scroll + brief highlight.
  const handleNodeCommentClick = useCallback((label: string) => {
    setChatScrollRequest({ key: Date.now(), label });
  }, []);

  const handleSendMessage = useCallback(async (content: string, options?: { replyOnly?: boolean; nodeContext?: { nodeId?: string; label: string } }) => {
      const currentActiveId = activeIdRef.current ?? activeId;
      const currentHermes = hermesConfigRef.current ?? hermesConfig;
      if (!currentActiveId || !currentHermes) return;

      setChatLoading(true);

      // 3.2 / 3.5 Node context: if a node is selected OR the message contains a
      // resolved @-node-mention, set the explicit nodeContext for the API.
      // Make the correction target explicit in the message text for the
      // conversation history + diagram agent.
      const currentSelected = selectedNodeRef.current;
      const explicitContext = options?.nodeContext;
      const nodeContext: { nodeId?: string; label: string } | undefined =
        explicitContext ?? (currentSelected ? { nodeId: currentSelected.id, label: currentSelected.label } : undefined);

      let outgoingContent = content;
      if (!options?.replyOnly && nodeContext) {
        const prefix = buildNodeCommentPrefix(nodeContext.label);
        if (!outgoingContent.startsWith(prefix)) {
          outgoingContent = prefix + outgoingContent;
        }
      }

    if (!options?.replyOnly) {
          const optimisticUser: ChatMessage = {
            id: `temp-${Date.now()}`,
            processId: currentActiveId,
            conversationId: activeConversationIdRef.current,
            role: "user",
            content: outgoingContent,
            createdAt: new Date().toISOString(),
          };

          setActiveProcess((prev) =>
            prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev
          );
        }

    try {
      const res = await apiFetch(`/api/processes/${currentActiveId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(options?.replyOnly ? { replyOnly: true } : { content: outgoingContent }),
          ...(nodeContext ? { nodeContext } : {}),
          ...(activeConversationIdRef.current ? { conversationId: activeConversationIdRef.current } : {}),
          ...hermesApiBody(currentHermes),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Chat failed");
      }

      const data = await res.json();
      setActiveProcess(data.process);
      setChatLoading(false);

      // Clear node selection after the targeted correction message has been sent (3.2)
      if (nodeContext) {
        setSelectedNode(null);
      }

      // Ensure we have the latest persisted state (e.g. assistant reply) from server
      if (currentActiveId && businessId) {
        void loadProcess(currentActiveId, businessId).catch(() => {});
      }

      if (data.split) {
        toast.success(
          `Split complete — created "${data.split.childName}" workflow. Both are in the sidebar.`
        );
        setStreamingDiagram(null);
        await loadProcessList();
      } else if (data.approved) {
        toast.success("Process approved for automation");
        await loadProcessList();
      }

      if (data.runBackgroundAgents) {
        void runBackgroundAgents(currentActiveId);
      } else if (!data.split) {
        await loadProcessList();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error talking to Hermes");
      if (currentActiveId && businessId) await loadProcess(currentActiveId, businessId);
      setChatLoading(false);
    }
  }, [activeId, apiFetch, businessId, hermesConfig, loadProcess, loadProcessList, runBackgroundAgents]);

  const drainMessageQueue = useCallback(async () => {
    if (isDrainingQueueRef.current) return;
    if (chatLoadingRef.current || agentsRunningRef.current) return;
    if (messageQueueRef.current.length === 0) return;

    isDrainingQueueRef.current = true;
    try {
      while (messageQueueRef.current.length > 0) {
        await waitUntilAgentsIdle(
          () => chatLoadingRef.current || agentsRunningRef.current,
        );
        if (messageQueueRef.current.length === 0) break;

        const [next, ...rest] = messageQueueRef.current;
        messageQueueRef.current = rest;
        syncQueuedMessages();

        await handleSendMessage(next.content, { nodeContext: next.nodeContext });
        await waitUntilAgentsIdle(
          () => chatLoadingRef.current || agentsRunningRef.current,
        );
      }
    } finally {
      isDrainingQueueRef.current = false;
      if (
        messageQueueRef.current.length > 0 &&
        !chatLoadingRef.current &&
        !agentsRunningRef.current
      ) {
        void drainMessageQueue();
      }
    }
  }, [handleSendMessage, syncQueuedMessages]);

  useEffect(() => {
    void drainMessageQueue();
  }, [chatLoading, agentsRunning, drainMessageQueue]);

  const handleChatSend = useCallback(
    (
      content: string,
      options?: { nodeContext?: { nodeId?: string; label: string } },
    ) => {
      const explicitContext = options?.nodeContext;
      const nodeContext =
        explicitContext ??
        (selectedNodeRef.current
          ? { nodeId: selectedNodeRef.current.id, label: selectedNodeRef.current.label }
          : undefined);

      if (chatLoading || agentsRunning) {
        enqueueChatMessage(content, nodeContext ? { nodeContext } : undefined);
        if (nodeContext) {
          setSelectedNode(null);
        }
        return;
      }
      void handleSendMessage(content, options);
    },
    [agentsRunning, chatLoading, enqueueChatMessage, handleSendMessage],
  );

  const agentBusyLabel =
    chatLoading && agentsRunning
      ? "Hermes is replying and updating the diagram — new messages will queue"
      : agentsRunning
        ? "Updating diagram and process name — new messages will queue"
        : chatLoading
          ? "Hermes is thinking — new messages will queue"
          : null;

  // 3.5: Handle slash commands that the composer couldn't handle itself —
  // e.g. /export switches the workspace tab to the export panel.
  const handleSlashCommand = useCallback(
    (command: string, args: string): boolean => {
      if (command === "export") {
        setActiveTab("export");
        onMetaChangeRef.current?.({ workspaceTab: "export" });
        toast.success("Opened export menu");
        return true;
      }
      if (command === "split") {
        if (!activeIdRef.current) {
          toast.error("Select a process first");
          return true;
        }
        setSplitInstruction(args.trim());
        setSplitDialogOpen(true);
        return true;
      }
      // Unknown commands fall through; the composer shows a built-in /help.
      return false;
    },
    [toast],
  );

  const handleSplitApplied = useCallback(
    async (result: {
      process: unknown;
      split: {
        parentProcessId: string;
        childProcessId: string;
        childName: string;
        parentName: string;
      };
    }) => {
      if (result.process && typeof result.process === "object") {
        setActiveProcess(result.process as ProcessWithMessages);
      }
      setStreamingDiagram(null);
      toast.success(
        `Split complete — created "${result.split.childName}". Both are in the sidebar.`
      );
      await loadProcessList();
      if (activeIdRef.current && businessId) {
        void loadProcess(activeIdRef.current, businessId).catch(() => {});
      }
    },
    [businessId, loadProcess, loadProcessList, toast],
  );

  const handleWorkspaceTabChange = useCallback((tab: WorkspaceTab) => {
    setActiveTab(tab);
    onMetaChangeRef.current?.({ workspaceTab: tab });
  }, []);

  const trySendPendingReply = useCallback(() => {
    const pendingId = pendingReplyProcessIdRef.current;
    if (!pendingId || pendingReplySentRef.current) return;

    const currentActiveId = activeIdRef.current ?? activeId;
    if (!currentActiveId || pendingId !== currentActiveId) return;
    if (!activeProcess || loadingProcess || chatLoading) return;

    const currentHermes = hermesConfigRef.current ?? hermesConfig;
    if (!currentHermes) return;

    const lastMessage = activeProcess.messages.at(-1);
    if (!lastMessage || lastMessage.role !== "user") {
      pendingReplyProcessIdRef.current = null;
      return;
    }

    const sender = sendMessageRef.current;
    if (!sender) return;

    pendingReplySentRef.current = true;
    pendingReplyProcessIdRef.current = null;
    void sender(lastMessage.content, { replyOnly: true });
  }, [activeId, activeProcess, chatLoading, hermesConfig, loadingProcess]);

  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
    trySendPendingReply();
  }, [handleSendMessage, trySendPendingReply]);

  useEffect(() => {
    trySendPendingReply();
  }, [trySendPendingReply]);

  const conversationMessages = useMemo(() => {
    if (!activeProcess) return [];
    return activeConversationId
      ? activeProcess.messages.filter((m) => m.conversationId === activeConversationId)
      : activeProcess.messages;
  }, [activeProcess, activeConversationId]);

  const activeConversationTitle = useMemo(() => {
    if (!activeProcess?.conversations?.length || !activeConversationId) return null;
    return (
      activeProcess.conversations.find((c) => c.id === activeConversationId)?.title ?? null
    );
  }, [activeProcess, activeConversationId]);

  const diagramMentionables = useMemo(
    () => diagramNodes.map((n) => ({ ref: n.id, label: n.label, kind: "node" as const })),
    [diagramNodes],
  );

  /** 3.5 / 4.10: systems from discovery + known tools on the active process */
  const systemMentionables = useMemo((): Mentionable[] => {
    if (!activeProcess) return [];
    const systems = extractSystemsFromFields({
      name: activeProcess.name,
      description: activeProcess.description,
      trigger: activeProcess.trigger,
      inputs: activeProcess.inputs,
      outputs: activeProcess.outputs,
      manualSteps: activeProcess.manualSteps,
    });
    // Also scan diagram labels for known product names (e.g. node "Post to Slack")
    const fromDiagramLabels = extractSystemsFromFields({
      description: diagramNodes.map((n) => n.label).join(" "),
    });
    return systemsToMentionables([...systems, ...fromDiagramLabels]);
  }, [activeProcess, diagramNodes]);

  /** 4.10 + 3.5: actors/roles, then systems, then diagram steps */
  const workshopMentionables = useMemo((): Mentionable[] => {
    const fromPersonnel = personnelRoster
      ? personnelToMentionables(personnelRoster).map((m) => ({
          ref: m.ref,
          label: m.label,
          kind: m.kind as Mentionable["kind"],
          description: m.description,
        }))
      : [];
    const reserved = new Set([
      ...fromPersonnel.map((m) => m.label.toLowerCase()),
      ...systemMentionables.map((m) => m.label.toLowerCase()),
    ]);
    // Prefer personnel / systems when labels collide with a node name
    const fromDiagram = diagramMentionables.filter(
      (n) => !reserved.has(n.label.toLowerCase()),
    );
    return [...fromPersonnel, ...systemMentionables, ...fromDiagram];
  }, [personnelRoster, systemMentionables, diagramMentionables]);

  const handleDiagramNodesChange = useCallback((nodes: MermaidNodeInfo[]) => {
    setDiagramNodes((prev) => {
      if (
        prev.length === nodes.length &&
        prev.every((item, index) => item.id === nodes[index]?.id && item.label === nodes[index]?.label)
      ) {
        return prev;
      }
      return nodes;
    });
  }, []);

  const handleCommentsChange = useCallback(
    (comments: Map<string, { count: number; firstLabel: string }>) => {
      setCommentedNodes((prev) => {
        const nextKey = serializeNodeCommentSummary(comments);
        const prevKey = serializeNodeCommentSummary(prev);
        if (nextKey === prevKey) return prev;
        return new Map(comments);
      });
    },
    [],
  );

  const diagramChart = streamingDiagram ?? activeProcess?.diagramMermaid ?? null;
  const processName = activeProcess?.name ?? "Select a process";
  const isApproved =
    activeProcess?.status === "approved" || activeProcess?.status === "forged";
  const canApprove =
    activeProcess && canApproveForAutomation(activeProcess) && !approving;

  const splitAnalysis = useMemo(
    () => analyzeSplitCandidates(diagramChart),
    [diagramChart],
  );
  // Forged maps can still be multi-flow; allow split (apply reopens parent as draft).
  const showSplitButton =
    Boolean(activeProcess) &&
    !diagramStreaming &&
    splitAnalysis.showSplitButton;

  // PR-5: bind process chat into the global chatbar (one surface; no dual column).
  // Only the active multi-tab session owns the dock binding.
  // Always clear when inactive so home / other routes never keep process-chat chrome.
  useEffect(() => {
    if (!isActive) {
      registerProcessSession(null);
      return;
    }

    if (!activeProcess) {
      registerProcessSession(null);
      return;
    }

    const processId = activeProcess.id;
    const session: ProcessSessionBinding = {
      processId,
      processName: activeProcess.name,
      conversationId: activeConversationId,
      conversations: activeProcess.conversations ?? [],
      messages: conversationMessages,
      isLoading: chatLoading,
      agentBusyLabel,
      queuedMessages,
      selectedNode,
      mentionables: workshopMentionables,
      composerFocusKey,
      scrollToRequest: chatScrollRequest,
      onSend: handleChatSend,
      onSelectConversation: (convId) => {
        setActiveConversationId(convId);
        activeConversationIdRef.current = convId;
        persistConversationId(processId, convId);
        messageQueueRef.current = [];
        setQueuedMessages([]);
      },
      onForked: () => {
        if (activeId && businessId) void loadProcess(activeId, businessId);
      },
      onRemoveQueued: removeQueuedMessage,
      onClearQueue: clearMessageQueue,
      onClearNodeContext: clearSelectedNode,
      onSlashCommand: handleSlashCommand,
      onCommentsChange: handleCommentsChange,
      onOpenConnection: openHermesConnection,
    };

    registerProcessSession(session);
  }, [
    isActive,
    activeProcess,
    activeConversationId,
    conversationMessages,
    chatLoading,
    agentBusyLabel,
    queuedMessages,
    selectedNode,
    workshopMentionables,
    composerFocusKey,
    chatScrollRequest,
    handleChatSend,
    removeQueuedMessage,
    clearMessageQueue,
    clearSelectedNode,
    handleSlashCommand,
    handleCommentsChange,
    openHermesConnection,
    registerProcessSession,
    activeId,
    businessId,
    loadProcess,
  ]);

  useEffect(() => {
    if (!isActive) return;
    return () => {
      registerProcessSession(null);
    };
  }, [isActive, registerProcessSession]);

  // Open chatbar when a process is selected so mapping chat is discoverable
  useEffect(() => {
    if (!isActive) return;
    if (activeProcess?.id) {
      openChatbar();
    }
  }, [isActive, activeProcess?.id, openChatbar]);

  // Node select → focus process composer in chatbar
  useEffect(() => {
    if (!isActive || !selectedNode) return;
    focusComposer();
  }, [isActive, selectedNode, focusComposer]);

  return (
      <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
        <WorkshopPageContext
          processId={activeProcess?.id ?? activeId}
          processName={activeProcess?.name ?? null}
          processStatus={activeProcess?.status ?? null}
          department={activeProcess?.department ?? null}
          functionFilter={functionFilter}
          processCount={processes.length}
          selectedNodeLabel={selectedNode?.label ?? null}
        />
        <header className="shrink-0 border-b border-border px-4 py-2.5 flex items-center bg-bg">
          <div className="min-w-0">
            <h1 className="font-semibold text-sm text-text-strong">Workshop</h1>
          </div>
        </header>

      <div className="flex-1 flex min-h-0">
        <ProcessSidebar
          processes={filteredProcesses}
          functions={availableFunctions}
          functionFilter={functionFilter}
          onFunctionFilterChange={handleFunctionFilterChange}
          activeId={activeId}
          loading={loadingList}
          creating={creating}
          onSelect={handleSelectProcess}
          onCreate={handleCreateProcess}
          onRename={handleRenameProcess}
          onDelete={handleDeleteProcess}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-bg">
          {!loadingList && !businessId ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm space-y-3">
                <h2 className="text-sm font-semibold text-text-strong">No active business</h2>
                <p className="text-xs text-text-muted">
                  Select or create a business in Business Manager, then return to Workshop
                  to map processes.
                </p>
                <a href="/business-manager" className="btn-primary text-xs inline-flex">
                  Business Manager
                </a>
              </div>
            </div>
          ) : null}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">
                Process Diagram
              </div>
              <h1 className="text-lg font-semibold tracking-tight">
                {loadingProcess ? "Loading..." : processName}
              </h1>
              {diagramChart && activeTab === "diagram" && (
                <div className="text-[10px] text-text-soft">Click any node to target a correction</div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeProcess && (
                <span
                  className={`pill text-[10px] ${
                    isApproved ? "pill-green" : "bg-bg-muted text-text-muted border border-border"
                  }`}
                >
                  {isApproved
                    ? PROCESS_STATUS_LABELS.forged
                    : PROCESS_STATUS_LABELS.draft}
                </span>
              )}
              {showSplitButton && (
                <button
                  type="button"
                  onClick={() => {
                    setSplitInstruction("");
                    setSplitDialogOpen(true);
                  }}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  title="This diagram looks like multiple independent flows"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Split
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  onClick={handleApproveForAutomation}
                  disabled={approving}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Forge process
                </button>
              )}
              {isApproved && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUnforgeProcess}
                    disabled={unforging}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    title="Reopen as draft so agents can edit again"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    {unforging ? "Unforging…" : "Unforge"}
                  </button>
                  <Link
                    href={`/metrics?fromProcess=${encodeURIComponent(activeProcess!.id)}`}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    title="Instrument this process in Monitor"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Attach Measurement
                  </Link>
                  <Link
                    href="/automations"
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-green"
                    title="Open Automations list"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Automate
                  </Link>
                </div>
              )}
              {agentsRunning && (
                <div className="text-[10px] text-green flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
                  Updating diagram…
                </div>
              )}
              {activeProcess?.diagramUpdatedAt && !agentsRunning && (
                <div className="text-[10px] text-text-soft">
                  Updated {new Date(activeProcess.diagramUpdatedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <WorkspaceTabs
            active={activeTab}
            onChange={handleWorkspaceTabChange}
            hasDiagram={!!diagramChart}
            hasProcess={!!activeProcess}
          />

          {/* Diagram tab */}
          {(activeTab === "diagram" || !activeProcess) && (
            <div className="flex-1 min-h-0 relative bg-[radial-gradient(circle_at_1px_1px,#27272a_1px,transparent_0)] [background-size:24px_24px]">
              {!activeId ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <p className="text-text-muted text-sm mb-4">
                    Select a process from the left, or create a new one to start mapping.
                  </p>
                  <button onClick={handleCreateProcess} disabled={creating} className="btn-primary text-sm">
                    Create New Process
                  </button>
                </div>
              ) : loadingProcess && !activeProcess ? (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  Loading process...
                </div>
              ) : (
                <>
                  {showSplitButton && (
                    <div className="absolute top-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
                      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber/40 bg-bg-elevated/95 backdrop-blur px-3 py-2 shadow-lg max-w-lg">
                        <Scissors className="w-3.5 h-3.5 text-amber shrink-0" />
                        <p className="text-xs text-text-muted min-w-0">
                          <span className="text-text font-medium">
                            Looks like {splitAnalysis.componentCount} separate flows.
                          </span>{" "}
                          Split into single-process diagrams?
                        </p>
                        <button
                          type="button"
                          className="btn-primary text-[11px] py-1 px-2.5 shrink-0"
                          onClick={() => {
                            setSplitInstruction("");
                            setSplitDialogOpen(true);
                          }}
                        >
                          Split…
                        </button>
                      </div>
                    </div>
                  )}
                  <MermaidDiagram
                    chart={diagramChart}
                    isStreaming={diagramStreaming}
                    className="absolute inset-0 z-0"
                    onNodeClick={handleNodeClick}
                    selectedNodeLabel={selectedNode?.label}
                    selectedNode={selectedNode}
                    onDeselect={clearSelectedNode}
                    onNodesChange={handleDiagramNodesChange}
                    commentedNodes={commentedNodes}
                    onNodeCommentClick={handleNodeCommentClick}
                  />
                </>
              )}
            </div>
          )}

          {/* Details tab */}
          {activeTab === "details" && activeProcess && (
            <DetailsPanel process={activeProcess} />
          )}

          {/* Questions tab */}
          {activeTab === "questions" && activeProcess && (
            <QuestionsPanel
              process={activeProcess}
              onUpdated={(updated) => setActiveProcess(updated)}
            />
          )}

          {/* Source tab */}
          {activeTab === "source" && activeProcess && diagramChart && (
            <SourcePanel chart={diagramChart} />
          )}

          {/* Export tab — 3.8 */}
          {activeTab === "export" && activeProcess && (
            <ExportMenu
              processId={activeProcess.id}
              processName={activeProcess.name}
              mermaid={activeProcess.diagramMermaid}
              messages={conversationMessages}
              conversationTitle={
                (activeProcess.conversations?.length ?? 0) > 1
                  ? activeConversationTitle
                  : null
              }
            />
          )}
        </main>
      </div>

      {activeProcess && (
        <SplitProcessDialog
          open={splitDialogOpen}
          onClose={() => setSplitDialogOpen(false)}
          processId={activeProcess.id}
          processName={activeProcess.name}
          hermes={hermesConfig}
          initialInstruction={splitInstruction}
          apiFetch={apiFetch}
          onApplied={(result) => {
            void handleSplitApplied(result);
          }}
        />
      )}
    </div>
  );
}