"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { AutomationSidebar } from "@/components/automations/AutomationSidebar";
import { MermaidDiagram } from "@/components/workshop/MermaidDiagram";
import { N8nConnectionDialog } from "@/components/n8n/N8nConnectionDialog";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { automationStatusToDeployStatus } from "@/lib/automation-types";
import type { AutomationSessionBinding } from "@/lib/chatbar/automation-session";
import {
  isUnifiedAutomationChatEnabled,
  type PageChatModule,
} from "@/lib/chatbar/page-module";
import type { AutomationStudioData } from "@/lib/automation-types";

type PageProps = { params: Promise<{ processId: string }> };

export default function AutomationStudioPage({ params }: PageProps) {
  const { processId } = use(params);
  const router = useRouter();
  const { openHermesConnection, currentBusiness } = useShell();
  const { config: hermesConfig } = useHermesConnection();
  const {
    registerAutomationSession,
    registerPageModule,
    open: openChatbar,
  } = useChatbar();

  const [studio, setStudio] = useState<AutomationStudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [n8nConnectionOpen, setN8nConnectionOpen] = useState(false);
  const [credentialMap, setCredentialMap] = useState<AutomationStudioData["credentialMap"]>({});

  const syncCronIfConnected = useCallback(
    async (
      studioData: AutomationStudioData,
      options?: { silent?: boolean }
    ): Promise<AutomationStudioData> => {
      if (!hermesConfig?.baseUrl || !hermesConfig.apiKey) return studioData;
      if (studioData.automation.externalId) return studioData;

      try {
        const res = await fetch(`/api/processes/${processId}/automation/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hermesApiBody(hermesConfig)),
        });
        if (!res.ok) return studioData;

        const data = await res.json();
        if (data.linked && data.studio) {
          if (!options?.silent) {
            toast.success("Detected existing Hermes cron job for this process");
          }
          return data.studio;
        }
        return data.studio ?? studioData;
      } catch {
        return studioData;
      }
    },
    [hermesConfig, processId]
  );

  const loadStudio = useCallback(async () => {
    setLoading(true);
    try {
      const studioRes = await fetch(`/api/processes/${processId}/automation`);

      if (studioRes.status === 401) {
        router.push("/");
        return;
      }
      if (studioRes.status === 403) {
        toast.error("Process must be approved for automation first");
        router.push("/automations");
        return;
      }
      if (!studioRes.ok) throw new Error("Failed to load studio");

      let data: AutomationStudioData = await studioRes.json();
      data = await syncCronIfConnected(data);
      setStudio(data);
      setCredentialMap(data.credentialMap ?? {});
    } catch {
      toast.error("Failed to load automation studio");
      router.push("/automations");
    } finally {
      setLoading(false);
    }
  }, [processId, router, syncCronIfConnected]);

  useEffect(() => {
    loadStudio();
  }, [loadStudio, currentBusiness?.id]);

  useEffect(() => {
    if (!studio || !hermesConfig?.baseUrl || !hermesConfig.apiKey) return;
    if (studio.automation.externalId) return;

    void (async () => {
      const synced = await syncCronIfConnected(studio, { silent: true });
      if (synced.automation.externalId) {
        setStudio(synced);
        setCredentialMap(synced.credentialMap ?? {});
        toast.success("Detected existing Hermes cron job for this process");
      }
    })();
  }, [hermesConfig, studio, syncCronIfConnected]);

  const runExtraction = useCallback(
    async (pid: string) => {
      if (!hermesConfig) return;
      setExtracting(true);
      try {
        const res = await fetch(`/api/processes/${pid}/automation/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hermesApiBody(hermesConfig)),
        });
        if (!res.ok) {
          toast.warning("Could not update automation plan");
          return;
        }
        const data = await res.json();
        if (data.updated && data.studio) {
          setStudio(data.studio);
          if (data.cronLinked) {
            toast.success("Detected existing Hermes cron job for this process");
          } else if (data.planReady) {
            toast.success("Automation plan ready to deploy");
          }
        }
      } finally {
        setExtracting(false);
      }
    },
    [hermesConfig]
  );

  async function handleCredentialMapChange(map: AutomationStudioData["credentialMap"]) {
    setCredentialMap(map);
    try {
      const res = await fetch(`/api/processes/${processId}/automation/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialMap: map }),
      });
      if (res.ok) {
        const data = await res.json();
        setStudio(data);
      }
    } catch {
      toast.error("Failed to save credential mapping");
    }
  }

  async function handleAgentChange(agentId: string | null) {
    try {
      const res = await fetch(`/api/processes/${processId}/automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hermesAgentProfileId: agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign agent");
      setStudio(data);
      toast.success(
        agentId
          ? `Assigned ${data.assignedAgent?.displayName ?? "agent"}`
          : "Cleared agent assignment"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign agent");
    }
  }

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!hermesConfig || !studio) return;

      setChatLoading(true);

      const optimisticUser = {
        id: `temp-${Date.now()}`,
        automationId: studio.automation.id,
        role: "user" as const,
        content,
        createdAt: new Date().toISOString(),
      };

      setStudio((prev) =>
        prev
          ? {
              ...prev,
              automation: {
                ...prev.automation,
                messages: [...prev.automation.messages, optimisticUser],
              },
            }
          : prev
      );

      try {
        const res = await fetch(`/api/processes/${processId}/automation/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            ...hermesApiBody(hermesConfig),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Chat failed");
        }

        const data = await res.json();
        setStudio(data);
        setChatLoading(false);

        if (data.cronLinked) {
          toast.success("Detected existing Hermes cron job for this process");
        }

        if (data.runExtraction) {
          void runExtraction(processId);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error talking to Hermes");
        await loadStudio();
        setChatLoading(false);
      }
    },
    [hermesConfig, studio, processId, runExtraction, loadStudio]
  );

  // Task 6: unified chatbar page module (preferred). Legacy session if flag off.
  const useUnifiedChat = isUnifiedAutomationChatEnabled();

  useEffect(() => {
    if (!studio) {
      registerPageModule(null);
      registerAutomationSession(null);
      return;
    }

    if (useUnifiedChat) {
      registerAutomationSession(null);
      const mod: PageChatModule = {
        routeKey: "automation-studio",
        promptPack: "automation-architect",
        pin: {
          type: "automation",
          id: processId,
          label: studio.process.name,
        },
        statusLabel: extracting ? "Updating plan…" : null,
        onAutomationTurnComplete: ({
          processId: pid,
          runExtraction: shouldExtract,
          cronLinked,
          studio: studioPayload,
        }) => {
          if (
            studioPayload &&
            typeof studioPayload === "object" &&
            "automation" in studioPayload
          ) {
            setStudio(studioPayload as AutomationStudioData);
            const map = (studioPayload as AutomationStudioData).credentialMap;
            if (map) setCredentialMap(map);
          } else {
            void loadStudio();
          }
          if (cronLinked) {
            toast.success("Detected existing Hermes cron job for this process");
          }
          if (shouldExtract) {
            void runExtraction(pid);
          }
        },
      };
      registerPageModule(mod);
      return;
    }

    registerPageModule(null);
    const session: AutomationSessionBinding = {
      processId,
      processName: studio.process.name,
      messages: studio.automation.messages,
      isLoading: chatLoading,
      extractingLabel: extracting ? "Updating plan…" : null,
      onSend: (content) => {
        void handleSendMessage(content);
      },
      onOpenConnection: openHermesConnection,
    };

    registerAutomationSession(session);
  }, [
    studio,
    processId,
    chatLoading,
    extracting,
    handleSendMessage,
    openHermesConnection,
    registerAutomationSession,
    registerPageModule,
    useUnifiedChat,
    loadStudio,
    runExtraction,
  ]);

  useEffect(() => {
    return () => {
      registerPageModule(null);
      registerAutomationSession(null);
    };
  }, [registerAutomationSession, registerPageModule]);

  // Open chatbar when entering automation studio so design chat is discoverable
  useEffect(() => {
    if (studio?.process.id) {
      openChatbar();
    }
  }, [studio?.process.id, openChatbar]);

  if (loading || !studio) {
    return (
      <div className="h-full flex items-center justify-center bg-bg text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const deployStatus = automationStatusToDeployStatus(studio.automation);

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between bg-bg">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Automation studio
          </div>
          <h1 className="font-semibold text-sm text-text-strong truncate max-w-[280px]">
            {studio.process.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {extracting && (
            <div className="text-[10px] text-green flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
              Updating plan…
            </div>
          )}
          <button
            type="button"
            onClick={loadStudio}
            className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <AutomationSidebar
          processName={studio.process.name}
          department={studio.process.department}
          trigger={studio.process.trigger}
          inputs={studio.process.inputs}
          outputs={studio.process.outputs}
          manualSteps={studio.process.manualSteps}
          plan={studio.plan}
          integrations={studio.integrations}
          automationStatus={deployStatus}
          processId={processId}
          automation={studio.automation}
          hiredAgents={studio.hiredAgents ?? []}
          assignedAgent={studio.assignedAgent ?? null}
          credentialMap={credentialMap}
          onCredentialMapChange={handleCredentialMapChange}
          onAgentChange={handleAgentChange}
          onDeployed={(next) => {
            setStudio(next);
            setCredentialMap(next.credentialMap ?? {});
          }}
          onOpenN8nConnection={() => setN8nConnectionOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-bg">
          <div className="px-5 py-3 border-b border-border shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">
              Approved process map
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{studio.process.name}</h1>
            <p className="text-[11px] text-text-muted mt-1">
              Design the automation in Hermes chat (right dock). Assign an agent and deploy from
              the left panel when the plan is ready.
            </p>
          </div>

          <div className="flex-1 min-h-0 relative bg-[radial-gradient(circle_at_1px_1px,#27272a_1px,transparent_0)] [background-size:24px_24px]">
            {studio.process.diagramMermaid ? (
              <MermaidDiagram
                chart={studio.process.diagramMermaid}
                className="absolute inset-0 z-0"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-sm p-8 text-center">
                No diagram on this process. Return to Workshop to map it first.
              </div>
            )}
          </div>
        </main>
      </div>

      <N8nConnectionDialog open={n8nConnectionOpen} onClose={() => setN8nConnectionOpen(false)} />
    </div>
  );
}
