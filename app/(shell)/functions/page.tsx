"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { useShellNavigate } from "@/components/shell/useShellNavigate";
import { FunctionsPageContext } from "@/components/chatbar/page-providers/FunctionsPageContext";
import {
  type AnalyticsBusiness,
  type AnalyticsProcess,
} from "@/components/functions/BusinessAnalyticsSection";
import { FunctionOrgChart } from "@/components/functions/FunctionOrgChart";
import { NewFunctionDialog } from "@/components/functions/NewFunctionDialog";
import { aggregateFunctions, normalizeDepartment } from "@/lib/functions";
import type { FunctionSummary } from "@/lib/functions";
import type { ProcessSummary } from "@/lib/types";

type DeclaredFunction = {
  id: string;
  name: string;
  description: string | null;
};

export default function FunctionsPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const { go } = useShellNavigate();
  const [business, setBusiness] = useState<AnalyticsBusiness | null>(null);
  const [processes, setProcesses] = useState<AnalyticsProcess[]>([]);
  const [declared, setDeclared] = useState<DeclaredFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  const [movingProcessId, setMovingProcessId] = useState<string | null>(null);

  const functions: FunctionSummary[] = useMemo(
    () =>
      aggregateFunctions(
        processes.map((p) => ({ department: p.department }) as ProcessSummary),
        declared,
      ),
    [processes, declared],
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
            status: p.status,
          })),
        );
        setDeclared(
          (data.functions || []).map((f: DeclaredFunction) => ({
            id: f.id,
            name: f.name,
            description: f.description ?? null,
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
        setDeclared([]);
      }
    } catch {
      toast.error("Failed to load functions");
      setBusiness(null);
      setProcesses([]);
      setDeclared([]);
    } finally {
      setLoading(false);
    }
  }, [router, currentBusiness]);

  useEffect(() => {
    load();
  }, [load, currentBusiness?.id]);

  // Drop expansion if the function disappears after a move/reload
  useEffect(() => {
    if (expandedFunction && !functions.some((f) => f.name === expandedFunction)) {
      setExpandedFunction(null);
    }
  }, [functions, expandedFunction]);

  function toggleFunction(name: string) {
    setExpandedFunction((prev) => (prev === name ? null : name));
  }

  async function moveWorkflow(processId: string, toFunction: string) {
    const target = normalizeDepartment(toFunction);
    const proc = processes.find((p) => p.id === processId);
    if (!proc) return;
    if (normalizeDepartment(proc.department) === target) return;

    setMovingProcessId(processId);
    // Optimistic update
    setProcesses((prev) =>
      prev.map((p) => (p.id === processId ? { ...p, department: target } : p)),
    );

    try {
      const res = await fetch(`/api/processes/${processId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: target,
          actor: "human",
          confirmLiveEdit: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to move workflow",
        );
      }
      const updated = await res.json();
      setProcesses((prev) =>
        prev.map((p) =>
          p.id === processId
            ? {
                ...p,
                department: updated.department ?? target,
                name: updated.name ?? p.name,
                status: updated.status ?? p.status,
              }
            : p,
        ),
      );
      toast.success(`Moved to ${target}`);
      setExpandedFunction(target);
    } catch (err) {
      // Revert
      setProcesses((prev) =>
        prev.map((p) =>
          p.id === processId ? { ...p, department: proc.department } : p,
        ),
      );
      toast.error(err instanceof Error ? err.message : "Failed to move workflow");
    } finally {
      setMovingProcessId(null);
    }
  }

  function handleFunctionCreated(fn: DeclaredFunction) {
    setDeclared((prev) => {
      if (prev.some((p) => p.name.toLowerCase() === fn.name.toLowerCase())) return prev;
      return [...prev, fn].sort((a, b) => a.name.localeCompare(b.name));
    });
    setExpandedFunction(fn.name);
    toast.success(`Added “${fn.name}” to the map`);
  }

  const businessName = business?.name || currentBusiness?.name || "Your business";
  const workflows = processes.map((p) => ({
    id: p.id,
    name: p.name,
    department: p.department,
    status: p.status ?? null,
  }));

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 w-full">
      <FunctionsPageContext
        business={business}
        processes={processes}
        functions={functions}
      />
      <div className="flex items-start justify-between mb-8 gap-4">
        <p className="text-sm text-text-muted max-w-2xl">
          Business areas and workflows. Click a function to list its workflows; use Move to reassign
          a workflow to another function.
        </p>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="btn-primary text-sm shrink-0"
          disabled={!business}
        >
          <Plus className="w-4 h-4" />
          New function
        </button>
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
        <>
          <section className="mb-12">
            {functions.length === 0 ? (
              <div className="function-org-chart function-org-chart--empty">
                <FunctionOrgChart
                  businessName={businessName}
                  functions={[]}
                  workflows={[]}
                  expandedFunction={null}
                  onToggleFunction={toggleFunction}
                  onMoveWorkflow={moveWorkflow}
                />
                <p className="text-sm text-text-muted text-center mt-6 max-w-md mx-auto">
                  No functions yet. Add a business area to the map, then group workflows under it.
                </p>
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => setNewOpen(true)}
                    className="btn-primary text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New function
                  </button>
                </div>
              </div>
            ) : (
              <FunctionOrgChart
                businessName={businessName}
                functions={functions}
                workflows={workflows}
                expandedFunction={expandedFunction}
                onToggleFunction={toggleFunction}
                onMoveWorkflow={moveWorkflow}
                movingProcessId={movingProcessId}
              />
            )}
          </section>
        </>
      )}

      <NewFunctionDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleFunctionCreated}
        existingNames={functions.map((f) => f.name)}
        industry={business?.industry}
        description={business?.description}
        goals={business?.goals}
      />
    </main>
  );
}
