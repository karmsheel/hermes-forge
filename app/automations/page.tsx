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
  Zap,
} from "lucide-react";
import { AppNav } from "@/components/shell/AppNav";
import { HermesConnectionDialog } from "@/components/hermes/HermesConnectionDialog";
import { HermesStatusBadge } from "@/components/hermes/HermesStatusBadge";
import {
  AUTOMATION_DEPLOY_LABELS,
  PROCESS_STATUS_LABELS,
  type AutomationDeployStatus,
} from "@/lib/process-status";
import type { ApprovedProcessSummary } from "@/lib/types";

function deployBadgeClass(status: AutomationDeployStatus): string {
  switch (status) {
    case "not_started":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "designing":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "ready_to_deploy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "deployed_cron":
    case "deployed_n8n":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "needs_credentials":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    default:
      return "bg-zinc-800 text-zinc-400 border-zinc-700";
  }
}

export default function AutomationsPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<ApprovedProcessSummary[]>([]);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionOpen, setConnectionOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
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
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="font-semibold text-sm">Automations</div>
              <div className="text-[11px] text-zinc-500">
                {businessName ? businessName : "Approved process maps ready to automate"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HermesStatusBadge onClick={() => setConnectionOpen(true)} />
            <button
              onClick={load}
              className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            <AppNav current="automations" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : !businessName ? (
          <div className="text-center py-16 card max-w-lg mx-auto">
            <Building2 className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No active project</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Select or create a project to see approved processes.
            </p>
            <Link href="/projects" className="btn-primary text-sm inline-flex items-center gap-2">
              Go to Projects <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : processes.length === 0 ? (
          <div className="text-center py-16 card max-w-xl mx-auto">
            <GitBranch className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No approved processes yet</h2>
            <p className="text-sm text-zinc-400 mb-6">
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
                <p className="text-sm text-zinc-500 mt-1">
                  {processes.length} process{processes.length === 1 ? "" : "es"} ready to design
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {processes.map((proc) => (
                <article
                  key={proc.id}
                  className="card border border-zinc-800 hover:border-zinc-700 transition-colors p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{proc.name}</h3>
                      {proc.description && (
                        <p className="text-sm text-zinc-500 truncate mt-0.5">{proc.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {PROCESS_STATUS_LABELS.approved}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {proc.department}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border ${deployBadgeClass(proc.automationStatus)}`}
                    >
                      {AUTOMATION_DEPLOY_LABELS[proc.automationStatus]}
                    </span>
                    {proc.approvedAt && (
                      <span className="text-[10px] text-zinc-600">
                        Approved {new Date(proc.approvedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-zinc-800">
                    <Link
                      href={`/automations/${proc.id}`}
                      className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                    >
                      Design automation
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      <HermesConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </div>
  );
}