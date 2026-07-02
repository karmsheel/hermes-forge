"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, Plus, ArrowRight, Loader2 } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import type { ProcessSummary } from "@/lib/types";

export default function FunctionsPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const [functions, setFunctions] = useState<Array<{ name: string; count: number }>>([]);
  const [bizName, setBizName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/processes");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      const procs: ProcessSummary[] = data.processes || [];
      setBizName(data.business?.name || currentBusiness?.name || null);

      // Aggregate unique functions (departments) with counts
      const map = new Map<string, number>();
      for (const p of procs) {
        const fn = (p.department || "Uncategorized").trim();
        map.set(fn, (map.get(fn) || 0) + 1);
      }
      const list = Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      setFunctions(list);
    } catch {
      toast.error("Failed to load functions");
      setFunctions([]);
    } finally {
      setLoading(false);
    }
  }, [router, currentBusiness?.name]);

  useEffect(() => {
    load();
  }, [load, currentBusiness?.id]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Your workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight">Functions</h1>
          {bizName && (
            <p className="text-sm text-accent mt-1">in {bizName}</p>
          )}
          <p className="text-sm text-text-muted mt-2">
            Relevant functions for the selected business. Workflows are auto-categorized on creation (e.g. Marketing, Revenue, Customer Service).
          </p>
        </div>
        <button onClick={() => router.push("/workshop")} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New Process
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : functions.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <FolderKanban className="w-10 h-10 text-text-soft mx-auto mb-3" />
          <p className="text-text-muted mb-4">
            No functions yet. Create processes for this business in the workshop — they will be auto-categorized into functions like Marketing or Revenue.
          </p>
          <button onClick={() => router.push("/workshop")} className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Go to Workshop
          </button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {functions.map((fn) => (
            <li key={fn.name}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push("/workshop")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") router.push("/workshop");
                }}
                className="card w-full p-5 text-left transition-colors flex items-center justify-between group cursor-pointer hover:border-accent"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center shrink-0">
                    <FolderKanban className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-lg truncate">{fn.name}</div>
                    <div className="text-xs text-text-soft mt-2">
                      {fn.count} workflow{fn.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-text-soft group-hover:text-text-strong transition-colors shrink-0 ml-3" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}