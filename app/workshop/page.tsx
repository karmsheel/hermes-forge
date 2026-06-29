"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, LayoutDashboard, RefreshCw } from "lucide-react";
import { ProcessSidebar } from "@/components/workshop/ProcessSidebar";
import { MermaidDiagram } from "@/components/workshop/MermaidDiagram";
import { ProcessChat } from "@/components/workshop/ProcessChat";
import { HermesConnectionDialog } from "@/components/hermes/HermesConnectionDialog";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type { ProcessSummary, ProcessWithMessages } from "@/lib/types";

export default function WorkshopPage() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [activeProcess, setActiveProcess] = useState<ProcessWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [agentsRunning, setAgentsRunning] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const { config: hermesConfig } = useHermesConnection();

  useEffect(() => {
    const savedProcessId = localStorage.getItem("activeProcessId");
    if (savedProcessId) setActiveId(savedProcessId);
  }, []);

  const loadProcessList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/processes");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!data.business) {
        window.location.href = "/projects";
        return;
      }
      setProcesses(data.processes || []);
      setBusinessName(data.business?.name || null);
    } catch {
      toast.error("Failed to load processes");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadProcess = useCallback(async (id: string) => {
    setLoadingProcess(true);
    try {
      const res = await fetch(`/api/processes/${id}`);
      if (!res.ok) throw new Error("Process not found");
      const process: ProcessWithMessages = await res.json();
      setActiveProcess(process);
      setActiveId(id);
      localStorage.setItem("activeProcessId", id);
    } catch {
      toast.error("Failed to load process");
      setActiveId(null);
      localStorage.removeItem("activeProcessId");
    } finally {
      setLoadingProcess(false);
    }
  }, []);

  useEffect(() => {
    loadProcessList();
  }, [loadProcessList]);

  useEffect(() => {
    if (activeId && !loadingList) {
      loadProcess(activeId);
    }
  }, [activeId, loadingList, loadProcess]);

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
      localStorage.setItem("activeProcessId", process.id);
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
    setActiveId(id);
  }

  const runBackgroundAgents = useCallback(
    async (processId: string) => {
      if (!hermesConfig) return;
      setAgentsRunning(true);

      const agentBody = JSON.stringify({
        baseUrl: hermesConfig.baseUrl,
        apiKey: hermesConfig.apiKey,
      });

      try {
        const [diagramResult, nameResult] = await Promise.allSettled([
          fetch(`/api/processes/${processId}/diagram`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: agentBody,
          }),
          fetch(`/api/processes/${processId}/suggest-name`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: agentBody,
          }),
        ]);

        if (diagramResult.status === "rejected") {
          toast.warning("Diagram subagent failed");
        } else if (!diagramResult.value.ok) {
          toast.warning("Diagram could not be updated");
        }

        if (nameResult.status === "fulfilled" && nameResult.value.ok) {
          const nameData = await nameResult.value.json();
          if (nameData.updated && nameData.process) {
            setActiveProcess(nameData.process);
            toast.success(`Named workflow: ${nameData.name}`);
          }
        }

        await loadProcess(processId);
        await loadProcessList();
      } finally {
        setAgentsRunning(false);
      }
    },
    [hermesConfig, loadProcess, loadProcessList]
  );

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

  async function handleSendMessage(content: string) {
    if (!activeId || !hermesConfig) return;

    setChatLoading(true);

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

    try {
      const res = await fetch(`/api/processes/${activeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          baseUrl: hermesConfig.baseUrl,
          apiKey: hermesConfig.apiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Chat failed");
      }

      const data = await res.json();
      setActiveProcess(data.process);
      setChatLoading(false);

      if (data.runBackgroundAgents) {
        void runBackgroundAgents(activeId);
      } else {
        await loadProcessList();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error talking to Hermes");
      if (activeId) await loadProcess(activeId);
      setChatLoading(false);
    }
  }

  const diagramChart = activeProcess?.diagramMermaid ?? null;
  const processName = activeProcess?.name ?? "Select a process";

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <header className="h-12 shrink-0 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-950">
        <div className="text-xs text-zinc-500">
          Left: processes · Center: live diagram · Right: chat
        </div>
        <div className="flex items-center gap-2">
          <HermesStatusBadge onClick={() => setConnectionOpen(true)} />
          <button
            onClick={() => {
              loadProcessList();
              if (activeId) loadProcess(activeId);
            }}
            className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <Link href="/projects" className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Projects
          </Link>
          <Link href="/dashboard" className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
            <LayoutDashboard className="w-3 h-3" /> Dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <ProcessSidebar
          processes={processes}
          activeId={activeId}
          businessName={businessName}
          loading={loadingList}
          creating={creating}
          onSelect={handleSelectProcess}
          onCreate={handleCreateProcess}
          onRename={handleRenameProcess}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Process Diagram
              </div>
              <h1 className="text-lg font-semibold tracking-tight">
                {loadingProcess ? "Loading..." : processName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {agentsRunning && (
                <div className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Updating diagram…
                </div>
              )}
              {activeProcess?.diagramUpdatedAt && !agentsRunning && (
                <div className="text-[10px] text-zinc-600">
                  Updated {new Date(activeProcess.diagramUpdatedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 relative bg-[radial-gradient(circle_at_1px_1px,#27272a_1px,transparent_0)] [background-size:24px_24px]">
            {!activeId ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <p className="text-zinc-400 text-sm mb-4">
                  Select a process from the left, or create a new one to start mapping.
                </p>
                <button onClick={handleCreateProcess} disabled={creating} className="btn-primary text-sm">
                  Create New Process
                </button>
              </div>
            ) : loadingProcess && !activeProcess ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Loading process...
              </div>
            ) : (
              <MermaidDiagram chart={diagramChart} className="absolute inset-0 z-0" />
            )}
          </div>

          {diagramChart && (
            <details className="shrink-0 border-t border-zinc-800">
              <summary className="px-5 py-2 text-[10px] uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-zinc-400">
                Mermaid source
              </summary>
              <pre className="px-5 pb-3 text-[11px] font-mono text-zinc-500 overflow-x-auto max-h-24">
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
            onOpenConnection={() => setConnectionOpen(true)}
          />
        ) : (
          <div className="w-[380px] shrink-0 border-l border-zinc-800 bg-zinc-950 flex items-center justify-center p-6">
            <p className="text-xs text-zinc-500 text-center">
              Chat will appear here when you select or create a process.
            </p>
          </div>
        )}
      </div>

      <HermesConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </div>
  );
}