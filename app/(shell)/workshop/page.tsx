"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { canApproveForAutomation, PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { ProcessSidebar } from "@/components/workshop/ProcessSidebar";
import { MermaidDiagram } from "@/components/workshop/MermaidDiagram";
import { ProcessChat } from "@/components/workshop/ProcessChat";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { consumeDiagramStream } from "@/lib/diagram-sse-client";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import {
  clearActiveProcessId,
  consumePendingHermesReply,
  getActiveProcessId,
  setActiveProcessId,
} from "@/lib/workshop-storage";
import type { ProcessSummary, ProcessWithMessages } from "@/lib/types";

export default function WorkshopPage() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [activeProcess, setActiveProcess] = useState<ProcessWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentsRunning, setAgentsRunning] = useState(false);
  const [diagramStreaming, setDiagramStreaming] = useState(false);
  const [streamingDiagram, setStreamingDiagram] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const { openHermesConnection, openBusinessSwitcher } = useShell();
  const { config: hermesConfig, isConnected } = useHermesConnection();
  const pendingReplyProcessIdRef = useRef<string | null>(null);
  const pendingReplySentRef = useRef(false);

  useEffect(() => {
    pendingReplyProcessIdRef.current = consumePendingHermesReply();
  }, []);

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
        window.location.href = "/projects";
        return;
      }

      const list: ProcessSummary[] = data.processes || [];
      const currentBusinessId: string = data.business.id;

      setProcesses(list);
      setBusinessId(currentBusinessId);
      setBusinessName(data.business?.name || null);

      const savedProcessId = getActiveProcessId(currentBusinessId);
      const resolvedId =
        savedProcessId && list.some((p) => p.id === savedProcessId) ? savedProcessId : null;

      let selectionChanged = false;
      setActiveId((currentId) => {
        if (resolvedId === currentId) return currentId;
        selectionChanged = true;
        return resolvedId;
      });

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
      setActiveProcessId(projectId, id);
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
  }, [loadProcessList]);

  useEffect(() => {
    if (activeId && businessId && !loadingList) {
      loadProcess(activeId, businessId);
    }
  }, [activeId, businessId, loadingList, loadProcess]);

  async function handleCreateProcess() {
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
      if (businessId) setActiveProcessId(businessId, process.id);
      await loadProcessList();
      toast.success("New process started");
    } catch {
      toast.error("Failed to create process");
    } finally {
      setCreating(false);
    }
  }

  function handleSelectProcess(id: string) {
    if (id === activeId) return;
    setStreamingDiagram(null);
    setDiagramStreaming(false);
    setActiveId(id);
  }

  const runBackgroundAgents = useCallback(
    async (processId: string) => {
      if (!hermesConfig) return;
      setAgentsRunning(true);
      setDiagramStreaming(true);
      setStreamingDiagram(null);

      const agentBody = JSON.stringify({ ...hermesApiBody(hermesConfig), stream: true });
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

  const handleSendMessage = useCallback(async (content: string, options?: { replyOnly?: boolean }) => {
    if (!activeId || !hermesConfig) return;

    setChatLoading(true);

    if (!options?.replyOnly) {
      const optimisticUser = {
        id: `temp-${Date.now()}`,
        processId: activeId,
        role: "user" as const,
        content,
        createdAt: new Date().toISOString(),
      };

      setActiveProcess((prev) =>
        prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev
      );
    }

    try {
      const res = await fetch(`/api/processes/${activeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(options?.replyOnly ? { replyOnly: true } : { content }),
          ...hermesApiBody(hermesConfig),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Chat failed");
      }

      const data = await res.json();
      setActiveProcess(data.process);
      setChatLoading(false);

      if (data.approved) {
        toast.success("Process approved for automation");
        await loadProcessList();
      }

      if (data.runBackgroundAgents) {
        void runBackgroundAgents(activeId);
      } else {
        await loadProcessList();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error talking to Hermes");
      if (activeId && businessId) await loadProcess(activeId, businessId);
      setChatLoading(false);
    }
  }, [activeId, businessId, hermesConfig, loadProcess, loadProcessList, runBackgroundAgents]);

  useEffect(() => {
    const pendingProcessId = pendingReplyProcessIdRef.current;
    if (!pendingProcessId || pendingReplySentRef.current) return;
    if (pendingProcessId !== activeId) return;
    if (!activeProcess || !activeId || loadingProcess || chatLoading) return;
    if (!hermesConfig || !isConnected) return;

    const lastMessage = activeProcess.messages.at(-1);
    if (!lastMessage || lastMessage.role !== "user") return;

    pendingReplySentRef.current = true;
    pendingReplyProcessIdRef.current = null;
    void handleSendMessage(lastMessage.content, { replyOnly: true });
  }, [
    activeProcess,
    activeId,
    loadingProcess,
    chatLoading,
    hermesConfig,
    isConnected,
    handleSendMessage,
  ]);

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
          <button
            type="button"
            onClick={openBusinessSwitcher}
            className="font-semibold text-sm text-text-strong truncate max-w-[280px] flex items-center gap-1.5 hover:text-accent"
            title="Switch function"
          >
            <Building2 className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>{businessName || "Select a business"}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          <HermesStatusBadge onClick={openHermesConnection} />
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
          processes={processes}
          activeId={activeId}
          loading={loadingList}
          creating={creating}
          onSelect={handleSelectProcess}
          onCreate={handleCreateProcess}
          onRename={handleRenameProcess}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-bg">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">
                Process Diagram
              </div>
              <h1 className="text-lg font-semibold tracking-tight">
                {loadingProcess ? "Loading..." : processName}
              </h1>
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
              />
            )}
          </div>

          {diagramChart && (
            <details className="shrink-0 border-t border-border">
              <summary className="px-5 py-2 text-[10px] uppercase tracking-widest text-text-muted cursor-pointer hover:text-text">
                Mermaid source
              </summary>
              <pre className="px-5 pb-3 text-[11px] font-mono text-text-muted overflow-x-auto max-h-24">
                {diagramChart}
              </pre>
            </details>
          )}
        </main>

        {activeProcess ? (
          <ProcessChat
            messages={activeProcess.messages}
            processName={activeProcess.name}
            isLoading={chatLoading}
            onSend={handleSendMessage}
            onOpenConnection={openHermesConnection}
          />
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