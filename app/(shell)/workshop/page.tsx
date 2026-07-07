"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { canApproveForAutomation, PROCESS_STATUS_LABELS } from "@/lib/process-status";
import {
  parseNodeComment,
  normaliseLabel,
  serializeNodeCommentSummary,
} from "@/lib/node-comment";
import { ProcessSidebar } from "@/components/workshop/ProcessSidebar";
import { MermaidDiagram, type MermaidNodeInfo } from "@/components/workshop/MermaidDiagram";
import { ProcessChat } from "@/components/workshop/ProcessChat";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/workshop/WorkspaceTabs";
import { DetailsPanel } from "@/components/workshop/DetailsPanel";
import { SourcePanel } from "@/components/workshop/SourcePanel";
import { QuestionsPanel } from "@/components/workshop/QuestionsPanel";
import { ConversationsMenu } from "@/components/workshop/ConversationsMenu";
import { ExportMenu } from "@/components/export/ExportMenu";
import { consumeDiagramStream } from "@/lib/diagram-sse-client";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
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

export default function WorkshopPage() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [activeProcess, setActiveProcess] = useState<ProcessWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [functionFilter, setFunctionFilter] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentsRunning, setAgentsRunning] = useState(false);
  const [diagramStreaming, setDiagramStreaming] = useState(false);
  const [streamingDiagram, setStreamingDiagram] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);
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
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("diagram");
    // 3.4 Conversation fork
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const activeConversationIdRef = useRef<string | null>(null);
  const { openHermesConnection, currentBusiness, registerWorkshopNewProcess } = useShell();
  const { config: hermesConfig } = useHermesConnection();
  const pendingReplyProcessIdRef = useRef<string | null>(consumePendingHermesReply());
  const pendingReplySentRef = useRef(false);
  const pendingCreateRef = useRef(consumePendingNewProcess());
  const activeIdRef = useRef(activeId);
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
      const res = await fetch("/api/processes");
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      if (!data.business) {
        window.location.href = "/functions";
        return;
      }

      const list: ProcessSummary[] = data.processes || [];
      const currentBusinessId: string = data.business.id;

      setProcesses(list);
      setBusinessId(currentBusinessId);
      setBusinessName(data.business?.name || null);

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
      const resolvedId =
        savedProcessId && list.some((p) => p.id === savedProcessId) ? savedProcessId : null;

      let selectionChanged = false;
      setActiveId((currentId) => {
        if (resolvedId === currentId) return currentId;
        selectionChanged = true;
        return resolvedId;
      });

      activeIdRef.current = resolvedId;

      if (selectionChanged) {
        setActiveProcess(null);
        if (!resolvedId && savedProcessId) clearActiveProcessId(currentBusinessId);
      }
    } catch {
      toast.error("Failed to load processes");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadProcess = useCallback(async (id: string, projectId: string) => {
    setLoadingProcess(true);
    try {
      const res = await fetch(`/api/processes/${id}`);
      if (!res.ok) throw new Error("Process not found");
      const process: ProcessWithMessages = await res.json();
      setActiveProcess(process);
      setActiveId(id);
      activeIdRef.current = id; // sync immediately so replyOnly / handle calls see fresh id
      setActiveProcessId(projectId, id);

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
  }, []);

  useEffect(() => {
    loadProcessList();
  }, [loadProcessList, currentBusiness?.id]);

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
      const res = await fetch("/api/processes", {
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
      if (businessId) setActiveProcessId(businessId, process.id);
      await loadProcessList();
      setComposerFocusKey((k) => k + 1);
      toast.success("New process started");
    } catch {
      toast.error("Failed to create process");
    } finally {
      setCreating(false);
    }
  }, [businessId, creating, loadProcessList]);

  useEffect(() => {
    registerWorkshopNewProcess(handleCreateProcess);
    return () => registerWorkshopNewProcess(null);
  }, [handleCreateProcess, registerWorkshopNewProcess]);

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
            await fetch(`/api/processes/${processId}/diagram`, {
              method: "POST",
              headers: agentHeaders,
              body: agentBody,
            }),
            {
              onPreview: (mermaid) => {
                setStreamingDiagram(mermaid);
                setActiveProcess((prev) =>
                  prev && prev.id === processId
                    ? { ...prev, diagramMermaid: mermaid }
                    : prev
                );
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
            }
          ),
          fetch(`/api/processes/${processId}/suggest-name`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hermesApiBody(hermesConfig)),
          }),
        ]);

        if (diagramResult.status === "rejected") {
          toast.warning("Diagram subagent failed");
        } else if (!diagramResult.value.ok) {
          toast.warning(diagramResult.value.error || "Diagram could not be updated");
        }

        if (nameResult.status === "fulfilled" && nameResult.value.ok) {
          const nameData = await nameResult.value.json();
          if (nameData.updated && nameData.process) {
            setActiveProcess(nameData.process);
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
    [businessId, hermesConfig, loadProcess, loadProcessList]
  );

  async function handleApproveForAutomation() {
    if (!activeId || !activeProcess) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/processes/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Approval failed");
      }
      const updated = await res.json();
      setActiveProcess((prev) => (prev ? { ...prev, ...updated } : prev));
      await loadProcessList();
      toast.success("Process approved for automation");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve process");
    } finally {
      setApproving(false);
    }
  }

  async function handleRenameProcess(id: string, name: string) {
    const res = await fetch(`/api/processes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Rename failed");
    const updated = await res.json();
    if (activeId === id) {
      setActiveProcess((prev) => (prev ? { ...prev, name: updated.name, nameStatus: "confirmed" } : prev));
    }
    await loadProcessList();
    toast.success("Workflow renamed");
  }

  async function handleDeleteProcess(id: string) {
    const res = await fetch(`/api/processes/${id}`, { method: "DELETE" });
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
      const listRes = await fetch("/api/processes");
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
      const res = await fetch(`/api/processes/${currentActiveId}/chat`, {
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
  }, [activeId, businessId, hermesConfig, loadProcess, loadProcessList, runBackgroundAgents]);

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
    (command: string, _args: string): boolean => {
      if (command === "export") {
        setActiveTab("export");
        toast.success("Opened export menu");
        return true;
      }
      // Unknown commands fall through; the composer shows a built-in /help.
      return false;
    },
    [],
  );

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
  const isApproved = activeProcess?.status === "approved";
  const canApprove =
    activeProcess && canApproveForAutomation(activeProcess) && !approving;

  return (
      <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
        <header className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between bg-bg">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">Workshop</div>
            <h1 className="font-semibold text-sm text-text-strong truncate max-w-[280px]">
              {businessName || currentBusiness?.name || "Select a business"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadProcessList();
                if (activeId && businessId) loadProcess(activeId, businessId);
              }}
              className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
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
                    ? PROCESS_STATUS_LABELS.approved
                    : PROCESS_STATUS_LABELS.mapping}
                </span>
              )}
              {canApprove && (
                <button
                  type="button"
                  onClick={handleApproveForAutomation}
                  disabled={approving}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve for automation
                </button>
              )}
              {isApproved && (
                <Link
                  href="/automations"
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-green"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Open in Automations
                </Link>
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
            onChange={setActiveTab}
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

        {activeProcess ? (
          <div className="w-[380px] shrink-0 border-l border-border bg-bg-panel flex flex-col h-full">
            {activeProcess.conversations && activeProcess.conversations.length > 0 && (
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <ConversationsMenu
                  conversations={activeProcess.conversations}
                  activeConversationId={activeConversationId}
                  processId={activeProcess.id}
                  onSelect={(convId) => {
                    setActiveConversationId(convId);
                    activeConversationIdRef.current = convId;
                    persistConversationId(activeProcess.id, convId);
                    messageQueueRef.current = [];
                    setQueuedMessages([]);
                  }}
                  onForked={() => {
                    if (activeId && businessId) void loadProcess(activeId, businessId);
                  }}
                />
              </div>
            )}
            <ProcessChat
              messages={conversationMessages}
              processName={activeProcess.name}
              isLoading={chatLoading}
              onSend={handleChatSend}
              onOpenConnection={openHermesConnection}
              queuedMessages={queuedMessages}
              onRemoveQueued={removeQueuedMessage}
              onClearQueue={clearMessageQueue}
              agentBusyLabel={agentBusyLabel}
              composerFocusKey={composerFocusKey}
              selectedNode={selectedNode}
              onClearNodeContext={clearSelectedNode}
              mentionables={diagramMentionables}
              onSlashCommand={handleSlashCommand}
              onCommentsChange={handleCommentsChange}
              scrollToRequest={chatScrollRequest}
            />
          </div>
        ) : (
          <div className="w-[380px] shrink-0 border-l border-border bg-bg-panel flex items-center justify-center p-6">
            <p className="text-xs text-text-muted text-center">
              Chat will appear here when you select or create a process.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}