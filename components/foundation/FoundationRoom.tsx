"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useShell } from "@/components/shell/ShellContext";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { setActiveProcessId } from "@/lib/workshop-storage";
import type {
  FoundationOverview,
  SeedDraftInput,
} from "@/lib/foundation";
import { FoundationSidebar } from "./FoundationSidebar";
import { FoundationCanvas } from "./FoundationCanvas";
import { AddDraftDialog } from "./AddDraftDialog";

export function FoundationRoom() {
  const router = useRouter();
  const { currentBusiness, openNewBusiness } = useShell();
  const { open: openChat } = useChatbar();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<FoundationOverview | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/foundation");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as FoundationOverview;
      setOverview(data);
      setSelectedProcessId((prev) => {
        if (prev && data.processes.some((p) => p.id === prev)) return prev;
        return data.processes[0]?.id ?? null;
      });
    } catch {
      toast.error("Failed to load Foundation");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  function openWorkshop(processId: string) {
    if (currentBusiness?.id) {
      setActiveProcessId(currentBusiness.id, processId);
    }
    router.push("/workshop");
  }

  async function handleSeedDraft(draft: SeedDraftInput) {
    setCreating(true);
    try {
      const res = await fetch("/api/foundation/seed-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drafts: [draft], skipDuplicates: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to add draft");
      }
      if (data.skippedCount > 0 && data.createdCount === 0) {
        toast.message("A draft with that name already exists");
      } else {
        toast.success("Draft process added");
      }
      setAddOpen(false);
      await load();
      const createdId = data.created?.[0]?.id as string | undefined;
      if (createdId) setSelectedProcessId(createdId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add draft");
    } finally {
      setCreating(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!overview?.business) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Foundation</h1>
          <p className="text-sm text-text-muted">
            Create or select a business to sketch its process plant.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={openNewBusiness}>
            New business
          </button>
        </div>
      </div>
    );
  }

  const processes = overview.processes;
  const documents = overview.documents;
  // Progressive chrome: documents once seeded; processes always once room has loaded
  // (empty list still shows the Processes section so users know where drafts land)
  const showDocuments = documents.length > 0;
  const showProcesses = true;

  return (
    <div className="flex flex-col h-full min-h-0 flex-1">
      <header className="shrink-0 border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Map · Foundation
          </div>
          <h1 className="font-semibold text-sm text-text-strong truncate">
            Business foundations
          </h1>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {overview.stats.processCount} process
            {overview.stats.processCount === 1 ? "" : "es"}
            {" · "}
            {overview.stats.documentCount} document
            {overview.stats.documentCount === 1 ? "" : "s"}
            {overview.isThin ? " · early sketch" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => openChat()}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat with Hermes
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <FoundationSidebar
          businessName={overview.business.name}
          businessDescription={overview.business.description}
          processes={processes}
          documents={documents}
          showDocuments={showDocuments}
          showProcesses={showProcesses}
          selectedProcessId={selectedProcessId}
          onSelectProcess={setSelectedProcessId}
        />
        <FoundationCanvas
          processes={processes}
          selectedProcessId={selectedProcessId}
          onSelectProcess={setSelectedProcessId}
          onOpenWorkshop={openWorkshop}
          onAddDraft={() => setAddOpen(true)}
        />
      </div>

      <AddDraftDialog
        open={addOpen}
        creating={creating}
        onClose={() => setAddOpen(false)}
        onSubmit={handleSeedDraft}
      />
    </div>
  );
}
