"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  GitBranch,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";
import { useShell } from "@/components/shell/ShellContext";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { RunHealthCard } from "@/components/automations/RunHealthCard";
import { hermesApiBody } from "@/lib/hermes-models";
import {
  AUTOMATION_DEPLOY_LABELS,
  PROCESS_STATUS_LABELS,
  type AutomationDeployStatus,
} from "@/lib/process-status";
import type { ApprovedProcessSummary } from "@/lib/types";

function deployBadgeClass(status: AutomationDeployStatus): string {
  switch (status) {
    case "not_started":
      return "pill-amber";
    case "designing":
      return "pill-accent";
    case "ready_to_deploy":
    case "deployed_cron":
    case "deployed_n8n":
      return "pill-green";
    case "needs_credentials":
      return "pill-amber";
    default:
      return "bg-bg-muted text-text-muted border border-border";
  }
}

function runtimeBadge(proc: ApprovedProcessSummary): {
  label: string;
  className: string;
} | null {
  if (proc.automationStatus !== "deployed_cron" && proc.automationStatus !== "deployed_n8n") {
    return null;
  }
  const rt = proc.runHealth?.runtimeStatus ?? proc.runtimeStatus;
  if (rt === "paused") {
    return { label: "Paused", className: "pill-amber" };
  }
  if (rt === "failed" || proc.runHealth?.unhealthy) {
    return { label: "Unhealthy", className: "bg-rose-500/10 text-rose-400 border border-rose-500/25" };
  }
  if (proc.automationStatus === "deployed_cron") {
    return { label: "Active", className: "pill-green" };
  }
  return null;
}

function automationCtaLabel(status: AutomationDeployStatus): string {
  if (status === "deployed_cron" || status === "deployed_n8n") {
    return "View automation";
  }
  return "Design automation";
}

export default function AutomationsPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const { isRoomUnlocked } = useForgeStage();
  const operateReady = isRoomUnlocked("automate");
  const { config: hermesConfig, isConnected: hermesConnected } = useHermesConnection();
  const [processes, setProcesses] = useState<ApprovedProcessSummary[]>([]);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlId, setControlId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint =
        hermesConfig?.baseUrl && hermesConfig?.apiKey
          ? "/api/automations/sync"
          : "/api/automations";
      const init: RequestInit =
        endpoint === "/api/automations/sync"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(hermesApiBody(hermesConfig!)),
            }
          : {};

      const res = await fetch(endpoint, init);
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      if (!data.business) {
        setProcesses([]);
        setBusinessName(null);
        return;
      }
      setProcesses(data.processes || []);
      setBusinessName(data.business.name);
      if (data.linkedCount > 0) {
        toast.success(
          `Linked ${data.linkedCount} existing Hermes cron job${data.linkedCount === 1 ? "" : "s"}`
        );
      }
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [hermesConfig, router]);

  useEffect(() => {
    load();
  }, [load, currentBusiness?.id]);

  async function handleControl(processId: string, action: "pause" | "resume") {
    if (!hermesConfig) {
      toast.error("Connect Hermes to control cron jobs");
      return;
    }
    setControlId(processId);
    try {
      const res = await fetch(`/api/processes/${processId}/automation/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hermesApiBody(hermesConfig), action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      setProcesses((prev) =>
        prev.map((p) => {
          if (p.id !== processId) return p;
          return {
            ...p,
            runtimeStatus: data.health?.runtimeStatus ?? data.studio?.automation?.status ?? p.runtimeStatus,
            runHealth: data.health ?? p.runHealth,
          };
        })
      );
      toast.success(action === "pause" ? "Cron paused" : "Cron resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setControlId(null);
    }
  }

  return (
      <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
        <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-bg">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted">
              Automate room
            </div>
            <h1 className="font-semibold text-sm text-text-strong">Automations</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
              disabled={!operateReady}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </header>

      <main className="flex-1 overflow-y-auto max-w-6xl mx-auto px-6 py-10 w-full">
        {!operateReady ? (
          <SoftRoomLock
            room="automate"
            title="Automate opens after you forge a process"
            description="Refine a process in Workshop (Map room), forge it when the map is solid, then design automations here."
          />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : !businessName ? (
          <div className="text-center py-16 card max-w-lg mx-auto">
            <Building2 className="w-10 h-10 text-text-soft mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No active business</h2>
            <p className="text-sm text-text-muted mb-6">
              Select or create a business to see forged processes ready for automation.
            </p>
            <Link href="/functions" className="btn-primary text-sm inline-flex items-center gap-2">
              Go to Functions <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : processes.length === 0 ? (
          <div className="text-center py-16 card max-w-xl mx-auto">
            <GitBranch className="w-10 h-10 text-text-soft mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No forged processes yet</h2>
            <p className="text-sm text-text-muted mb-6">
              Map a process in Workshop and forge it when the diagram accurately represents
              how your business works. Forged maps appear here for automation design.
            </p>
            <Link href="/workshop" className="btn-primary text-sm inline-flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Open Workshop
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Approved for automation</h2>
                <p className="text-sm text-text-muted mt-1">
                  {processes.length} process{processes.length === 1 ? "" : "es"} ready to design
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {processes.map((proc) => (
                <article
                  key={proc.id}
                  className="card border border-border hover:border-border-strong transition-colors p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{proc.name}</h3>
                      {proc.description && (
                        <p className="text-sm text-text-muted truncate mt-0.5">{proc.description}</p>
                      )}
                    </div>
                    <span className="pill pill-green text-[10px] shrink-0">
                      {PROCESS_STATUS_LABELS.forged}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-bg-muted text-text-muted">
                      {proc.department}
                    </span>
                    <span className={`pill text-[10px] ${deployBadgeClass(proc.automationStatus)}`}>
                      {AUTOMATION_DEPLOY_LABELS[proc.automationStatus]}
                    </span>
                    {(() => {
                      const rt = runtimeBadge(proc);
                      return rt ? (
                        <span className={`pill text-[10px] ${rt.className}`}>{rt.label}</span>
                      ) : null;
                    })()}
                    {proc.assignedAgent && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-bg-muted text-text-muted">
                        Agent: {proc.assignedAgent.displayName}
                      </span>
                    )}
                    {proc.approvedAt && (
                      <span className="text-[10px] text-text-soft">
                        Approved {new Date(proc.approvedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {proc.automationStatus === "deployed_cron" && (
                    <div className="mb-3 space-y-2">
                      <RunHealthCard health={proc.runHealth} compact />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-[11px] flex-1 flex items-center justify-center gap-1 py-1"
                          disabled={
                            !hermesConnected ||
                            controlId === proc.id ||
                            (proc.runHealth?.runtimeStatus ?? proc.runtimeStatus) === "paused"
                          }
                          onClick={() => void handleControl(proc.id, "pause")}
                        >
                          {controlId === proc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Pause className="w-3 h-3" />
                          )}
                          Pause
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-[11px] flex-1 flex items-center justify-center gap-1 py-1"
                          disabled={
                            !hermesConnected ||
                            controlId === proc.id ||
                            (proc.runHealth?.runtimeStatus ?? proc.runtimeStatus) !== "paused"
                          }
                          onClick={() => void handleControl(proc.id, "resume")}
                        >
                          {controlId === proc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          Resume
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-border">
                    <Link
                      href={`/automations/${proc.id}`}
                      className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                    >
                      {automationCtaLabel(proc.automationStatus)}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}