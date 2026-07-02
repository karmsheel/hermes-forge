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
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { HermesModelSwitcher } from "@/components/hermes/HermesModelSwitcher";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
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

function automationCtaLabel(status: AutomationDeployStatus): string {
  if (status === "deployed_cron" || status === "deployed_n8n") {
    return "View automation";
  }
  return "Design automation";
}

export default function AutomationsPage() {
  const router = useRouter();
  const { openHermesConnection, currentBusiness } = useShell();
  const { config: hermesConfig } = useHermesConnection();
  const [processes, setProcesses] = useState<ApprovedProcessSummary[]>([]);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-bg">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Automations</div>
          <h1 className="font-semibold text-sm text-text-strong">
            {businessName ?? "Approved process maps"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <HermesModelSwitcher onOpenConnection={openHermesConnection} />
          <HermesStatusBadge onClick={openHermesConnection} />
          <button
            onClick={load}
            className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-6xl mx-auto px-6 py-10 w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : !businessName ? (
          <div className="text-center py-16 card max-w-lg mx-auto">
            <Building2 className="w-10 h-10 text-text-soft mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No active function</h2>
            <p className="text-sm text-text-muted mb-6">
              Select or create a function to see approved processes.
            </p>
            <Link href="/projects" className="btn-primary text-sm inline-flex items-center gap-2">
              Go to Functions <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : processes.length === 0 ? (
          <div className="text-center py-16 card max-w-xl mx-auto">
            <GitBranch className="w-10 h-10 text-text-soft mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No approved processes yet</h2>
            <p className="text-sm text-text-muted mb-6">
              Map a process in the Workshop and approve it when the diagram accurately represents
              how your business works. Approved maps appear here for automation design.
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
                      {PROCESS_STATUS_LABELS.approved}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-bg-muted text-text-muted">
                      {proc.department}
                    </span>
                    <span className={`pill text-[10px] ${deployBadgeClass(proc.automationStatus)}`}>
                      {AUTOMATION_DEPLOY_LABELS[proc.automationStatus]}
                    </span>
                    {proc.approvedAt && (
                      <span className="text-[10px] text-text-soft">
                        Approved {new Date(proc.approvedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

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