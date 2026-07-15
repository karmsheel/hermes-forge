"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { useShellNavigate } from "@/components/shell/useShellNavigate";
import {
  BusinessAnalyticsSection,
  type AnalyticsBusiness,
  type AnalyticsProcess,
} from "@/components/functions/BusinessAnalyticsSection";

export default function AutomationAnalysisPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const { go } = useShellNavigate();
  const [business, setBusiness] = useState<AnalyticsBusiness | null>(null);
  const [processes, setProcesses] = useState<AnalyticsProcess[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();

      if (data && data.id) {
        setBusiness({
          id: data.id,
          name: data.name,
          description: data.description,
          industry: data.industry,
          teamSize: data.teamSize,
          goals: data.goals,
        });
        setProcesses(
          (data.processes || []).map((p: AnalyticsProcess) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            department: p.department,
            automationScore: p.automationScore,
            estimatedTimeSaved: p.estimatedTimeSaved,
            trigger: p.trigger,
            manualSteps: p.manualSteps,
            status: p.status,
          })),
        );
      } else {
        setBusiness(
          currentBusiness
            ? {
                id: currentBusiness.id,
                name: currentBusiness.name,
                description: null,
                industry: null,
                teamSize: null,
                goals: null,
              }
            : null,
        );
        setProcesses([]);
      }
    } catch {
      toast.error("Failed to load automation analysis");
      setBusiness(null);
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [router, currentBusiness]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Automate stage
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Automation Analysis</h1>
        <p className="text-sm text-text-muted mt-2 max-w-2xl">
          Ranked automation opportunities and process scores for the active business. Use this to
          decide what to design next in Automations.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : !business ? (
        <div className="card p-10 text-center border-dashed">
          <p className="text-text-muted mb-4">
            No active business. Select or create one in Business Manager.
          </p>
          <button type="button" onClick={() => go("/business-manager")} className="btn-primary">
            Open Business Manager
          </button>
        </div>
      ) : (
        <BusinessAnalyticsSection
          business={business}
          processes={processes}
          onRefresh={() => void load()}
        />
      )}
    </main>
  );
}
