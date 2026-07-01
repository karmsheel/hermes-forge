"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { AutomationSidebar } from "@/components/automations/AutomationSidebar";
import { AutomationChat } from "@/components/automations/AutomationChat";
import { MermaidDiagram } from "@/components/workshop/MermaidDiagram";
import { N8nConnectionDialog } from "@/components/n8n/N8nConnectionDialog";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { automationStatusToDeployStatus } from "@/lib/automation-types";
import type { AutomationStudioData } from "@/lib/automation-types";

type PageProps = { params: Promise<{ processId: string }> };

export default function AutomationStudioPage({ params }: PageProps) {
  const { processId } = use(params);
  const router = useRouter();
  const { openHermesConnection } = useShell();
  const { config: hermesConfig } = useHermesConnection();

  const [studio, setStudio] = useState<AutomationStudioData | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [n8nConnectionOpen, setN8nConnectionOpen] = useState(false);
  const [credentialMap, setCredentialMap] = useState<AutomationStudioData["credentialMap"]>({});

  const loadStudio = useCallback(async () => {
    setLoading(true);
    try {
      const [studioRes, bizRes] = await Promise.all([
        fetch(`/api/processes/${processId}/automation`),
        fetch("/api/automations"),
      ]);

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

      const data: AutomationStudioData = await studioRes.json();
      setStudio(data);
      setCredentialMap(data.credentialMap ?? {});

      if (bizRes.ok) {
        const biz = await bizRes.json();
        setBusinessName(biz.business?.name ?? null);
      }
    } catch {
      toast.error("Failed to load automation studio");
      router.push("/automations");
    } finally {
      setLoading(false);
    }
  }, [processId, router]);

  useEffect(() => {
    loadStudio();
  }, [loadStudio]);

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
          if (data.planReady) {
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

  async function handleSendMessage(content: string) {
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

      if (data.runExtraction) {
        void runExtraction(processId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error talking to Hermes");
      await loadStudio();
      setChatLoading(false);
    }
  }

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
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Automation studio</div>
          <h1 className="font-semibold text-sm text-text-strong truncate max-w-[280px]">
            {businessName ? `${businessName} · ${studio.process.name}` : studio.process.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          {extracting && (
            <div className="text-[10px] text-green flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
              Updating plan…
            </div>
          )}
          <HermesStatusBadge onClick={openHermesConnection} />
          <button
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
          businessName={businessName}
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
          credentialMap={credentialMap}
          onCredentialMapChange={handleCredentialMapChange}
          onDeployed={(next) => {
            setStudio(next);
            setCredentialMap(next.credentialMap ?? {});
          }}
          onOpenN8nConnection={() => setN8nConnectionOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-bg">
          <div className="px-5 py-3 border-b border-border shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">
              Approved process map
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{studio.process.name}</h1>
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

        <AutomationChat
          messages={studio.automation.messages}
          processName={studio.process.name}
          isLoading={chatLoading}
          onSend={handleSendMessage}
          onOpenConnection={openHermesConnection}
        />
      </div>

      <N8nConnectionDialog open={n8nConnectionOpen} onClose={() => setN8nConnectionOpen(false)} />
    </div>
  );
}