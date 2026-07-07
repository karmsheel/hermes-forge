"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import {
  BusinessAnalyticsSection,
  type AnalyticsBusiness,
  type AnalyticsProcess,
} from "@/components/functions/BusinessAnalyticsSection";
import { FunctionOrgChart } from "@/components/functions/FunctionOrgChart";
import { aggregateFunctions } from "@/lib/functions";
import type { FunctionSummary } from "@/lib/functions";
import type { ProcessSummary } from "@/lib/types";
import { setActiveFunctionFilter } from "@/lib/workshop-storage";

export default function FunctionsPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const [business, setBusiness] = useState<AnalyticsBusiness | null>(null);
  const [processes, setProcesses] = useState<AnalyticsProcess[]>([]);
  const [loading, setLoading] = useState(true);

  const functions: FunctionSummary[] = useMemo(
    () =>
      aggregateFunctions(
        processes.map((p) => ({ department: p.department }) as ProcessSummary),
      ),
    [processes],
  );

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
      toast.error("Failed to load functions");
      setBusiness(null);
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [router, currentBusiness]);

  useEffect(() => {
    load();
  }, [load, currentBusiness?.id]);

  function openFunctionInWorkshop(functionName: string) {
    const businessId = business?.id || currentBusiness?.id;
    if (businessId) {
      setActiveFunctionFilter(businessId, functionName);
    }
    router.push("/workshop");
  }

  const businessName = business?.name || currentBusiness?.name || "Your business";

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Your workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight">Functions</h1>
          <p className="text-sm text-text-muted mt-2 max-w-2xl">
            Business areas and workflows for the active business. Click a function to open it in the
            workshop.
          </p>
        </div>
        <button type="button" onClick={() => router.push("/workshop")} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New process
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : !business ? (
        <div className="card p-10 text-center border-dashed">
          <p className="text-text-muted mb-4">No active business. Select or create one in Business Manager.</p>
          <button type="button" onClick={() => router.push("/business-manager")} className="btn-primary">
            Open Business Manager
          </button>
        </div>
      ) : (
        <>
          <section className="mb-12">
            {functions.length === 0 ? (
              <div className="function-org-chart function-org-chart--empty">
                <FunctionOrgChart
                  businessName={businessName}
                  functions={[]}
                  onSelectFunction={openFunctionInWorkshop}
                />
                <p className="text-sm text-text-muted text-center mt-6 max-w-md mx-auto">
                  No functions yet. Create processes in the workshop — they are grouped by department
                  (e.g. Marketing, Operations).
                </p>
                <div className="flex justify-center mt-4">
                  <button type="button" onClick={() => router.push("/workshop")} className="btn-primary text-sm">
                    <Plus className="w-4 h-4" />
                    Go to workshop
                  </button>
                </div>
              </div>
            ) : (
              <FunctionOrgChart
                businessName={businessName}
                functions={functions}
                onSelectFunction={openFunctionInWorkshop}
              />
            )}
          </section>

          <div className="border-t border-border pt-10">
            <BusinessAnalyticsSection
              business={business}
              processes={processes}
              onRefresh={() => void load()}
            />
          </div>
        </>
      )}
    </main>
  );
}