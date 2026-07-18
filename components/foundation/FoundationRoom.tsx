"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useShell } from "@/components/shell/ShellContext";
import { useForgeStage } from "@/components/shell/StageProvider";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { setActiveProcessId, setPendingHermesReply } from "@/lib/workshop-storage";
import type {
  FoundationOverview,
  SeedDraftInput,
} from "@/lib/foundation";
import {
  FOUNDATION_DRAFTS_EVENT,
  extractDraftsFromText,
  readRememberedStudioConversationId,
  type FoundationDraftsEventDetail,
  type ProposedDraft,
} from "@/lib/foundation-extract";
import { hermesApiBody } from "@/lib/hermes-models";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type { WorkflowTemplate } from "@/lib/workflow-templates";
import { templateToFoundationDrafts } from "@/lib/workflow-templates";
import { TemplateCards } from "@/components/home/TemplateCards";
import { FoundationSidebar } from "./FoundationSidebar";
import { FoundationCanvas } from "./FoundationCanvas";
import { AddDraftDialog } from "./AddDraftDialog";
import {
  DraftReviewPanel,
  toReviewRows,
  type ReviewDraftRow,
} from "./DraftReviewPanel";

export function FoundationRoom() {
  const router = useRouter();
  const { currentBusiness, openNewBusiness } = useShell();
  const { refreshReadiness } = useForgeStage();
  const { open: openChat } = useChatbar();
  const { config: hermesConfig, isConnected } = useHermesConnection();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<FoundationOverview | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewDraftRow[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSource, setReviewSource] = useState<string | undefined>();
  const [applying, setApplying] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [seedingTemplate, setSeedingTemplate] = useState(false);

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
      void refreshReadiness();
    } catch {
      toast.error("Failed to load Foundation");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [router, refreshReadiness]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  const openReview = useCallback(
    (drafts: ProposedDraft[], sourceLabel?: string) => {
      if (!drafts.length) {
        toast.message("No draft processes found to review");
        return;
      }
      setReviewRows(toReviewRows(drafts));
      setReviewSource(sourceLabel);
      setReviewOpen(true);
    },
    []
  );

  // Chatbar → Foundation: assistant emitted ```forge-drafts```
  useEffect(() => {
    function onDrafts(ev: Event) {
      const detail = (ev as CustomEvent<FoundationDraftsEventDetail>).detail;
      if (!detail?.drafts?.length) return;
      const existing =
        overview?.processes.map((p) => ({ id: p.id, name: p.name })) ?? [];
      const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));
      const proposed: ProposedDraft[] = detail.drafts.map((d) => {
        const key = d.name.trim().toLowerCase();
        const id = byName.get(key) ?? null;
        return {
          ...d,
          existingProcessId: id,
          isDuplicate: Boolean(id),
        };
      });
      // Also normalize via fence parser for consistent shape ids
      const viaFence = extractDraftsFromText(
        "```forge-drafts\n" + JSON.stringify(detail.drafts) + "\n```",
        existing
      );
      openReview(viaFence.drafts.length ? viaFence.drafts : proposed, "chat");
    }
    window.addEventListener(FOUNDATION_DRAFTS_EVENT, onDrafts);
    return () => window.removeEventListener(FOUNDATION_DRAFTS_EVENT, onDrafts);
  }, [openReview, overview?.processes]);

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
        body: JSON.stringify({ drafts: [draft], mode: "skip" }),
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

  /** 6.7 — template starters seed Foundation drafts in-room. */
  async function handleTemplateSeed(template: WorkflowTemplate) {
    if (seedingTemplate) return;
    setSeedingTemplate(true);
    try {
      const drafts = templateToFoundationDrafts(template);
      const res = await fetch("/api/foundation/seed-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drafts, mode: "skip" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to seed template");
      }

      const createdId = data.created?.[0]?.id as string | undefined;
      const skippedOnly =
        (data.createdCount ?? 0) === 0 && (data.skippedCount ?? 0) > 0;

      if (skippedOnly) {
        toast.message(`“${template.processName}” is already on the plant`);
      } else {
        toast.success(`Seeded “${template.processName}” draft`, {
          action: createdId
            ? {
                label: "Open Workshop",
                onClick: () => openWorkshop(createdId),
              }
            : undefined,
        });
      }

      await load();
      if (createdId) {
        setSelectedProcessId(createdId);
        if (currentBusiness?.id) {
          setActiveProcessId(currentBusiness.id, createdId);
          setPendingHermesReply(createdId);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed template");
    } finally {
      setSeedingTemplate(false);
    }
  }

  async function extractFromChat(opts?: { useHermes?: boolean }) {
    setExtracting(true);
    try {
      const conversationId = readRememberedStudioConversationId();
      if (!conversationId) {
        toast.message("Open the chatbar and discuss the business first");
        return;
      }

      const useHermes = opts?.useHermes !== false && isConnected && hermesConfig;
      const body: Record<string, unknown> = {
        apply: false,
        useHermes: Boolean(useHermes),
        conversationId,
      };
      if (useHermes && hermesConfig) {
        Object.assign(body, hermesApiBody(hermesConfig));
      }

      const res = await fetch("/api/foundation/extract-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Extract failed");
      }
      const drafts = (data.drafts || []) as ProposedDraft[];
      openReview(
        drafts,
        data.source === "fence"
          ? "chat fence"
          : data.source === "hermes"
            ? "Hermes extract"
            : "chat"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not extract drafts");
    } finally {
      setExtracting(false);
    }
  }

  async function applyReview() {
    const selected = reviewRows.filter((r) => r.selected && r.name.trim());
    if (!selected.length) return;
    setApplying(true);
    try {
      const res = await fetch("/api/foundation/seed-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upsert",
          drafts: selected.map((r) => ({
            name: r.name.trim(),
            description: r.description ?? null,
            department: r.department ?? null,
            ioShape: r.ioShape ?? null,
            trigger: r.trigger ?? null,
            inputs: r.inputs ?? null,
            outputs: r.outputs ?? null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Seed failed");

      const created = data.createdCount ?? 0;
      const updated = data.updatedCount ?? 0;
      const skipped = data.skippedCount ?? 0;
      toast.success(
        [
          created ? `${created} created` : null,
          updated ? `${updated} updated` : null,
          skipped ? `${skipped} skipped` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Done"
      );
      setReviewOpen(false);
      setReviewRows([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed drafts");
    } finally {
      setApplying(false);
    }
  }

  async function renameProcess(id: string, name: string) {
    const res = await fetch(`/api/processes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, actor: "human" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Rename failed");
    }
    await load();
    toast.success("Renamed");
  }

  async function deleteProcess(id: string, name: string) {
    if (!window.confirm(`Delete draft “${name}”? This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/processes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete");
      return;
    }
    toast.success("Deleted");
    if (selectedProcessId === id) setSelectedProcessId(null);
    if (linkFromId === id) setLinkFromId(null);
    await load();
  }

  async function createLink(fromId: string, toId: string) {
    const res = await fetch("/api/process-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromProcessId: fromId, toProcessId: toId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Could not create link");
      throw new Error(data.error || "create link failed");
    }
    toast.success("Linked processes");
    await load();
  }

  async function deleteLink(linkId: string) {
    if (!window.confirm("Remove this plant link?")) return;
    const res = await fetch(`/api/process-links/${linkId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete link");
      return;
    }
    toast.success("Link removed");
    setSelectedLinkId(null);
    await load();
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
  const showDocuments = documents.length > 0;
  const showProcesses = true;

  return (
    <div className="flex flex-col h-full min-h-0 flex-1">
      <header className="shrink-0 border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            Foundation room · Overlord
          </div>
          <h1 className="font-semibold text-sm text-text-strong truncate">
            Business foundations
          </h1>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {overview.stats.processCount} process
            {overview.stats.processCount === 1 ? "" : "es"}
            {" · "}
            {overview.stats.linkCount ?? overview.links?.length ?? 0} link
            {(overview.stats.linkCount ?? overview.links?.length ?? 0) === 1
              ? ""
              : "s"}
            {" · "}
            {overview.stats.documentCount} document
            {overview.stats.documentCount === 1 ? "" : "s"}
            {overview.isThin ? " · early sketch" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
            onClick={() => void extractFromChat()}
            disabled={extracting}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
            title="Extract draft processes from the studio chat thread"
          >
            {extracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Seed from chat
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
          links={overview.links ?? []}
          businessId={overview.business?.id ?? currentBusiness?.id ?? null}
          selectedProcessId={selectedProcessId}
          onSelectProcess={setSelectedProcessId}
          onOpenWorkshop={openWorkshop}
          onAddDraft={() => setAddOpen(true)}
          emptyExtra={
            <div
              className={`foundation-template-starters${seedingTemplate ? " is-busy" : ""}`}
              aria-busy={seedingTemplate}
            >
              <TemplateCards
                selectedId={null}
                onSelect={(t) => void handleTemplateSeed(t)}
              />
            </div>
          }
          onRename={renameProcess}
          onDelete={deleteProcess}
          linkMode={linkMode}
          onLinkModeChange={setLinkMode}
          linkFromId={linkFromId}
          onLinkFromChange={setLinkFromId}
          onCreateLink={createLink}
          onDeleteLink={deleteLink}
          selectedLinkId={selectedLinkId}
          onSelectLink={setSelectedLinkId}
        />
      </div>

      <AddDraftDialog
        open={addOpen}
        creating={creating}
        onClose={() => setAddOpen(false)}
        onSubmit={handleSeedDraft}
      />

      <DraftReviewPanel
        open={reviewOpen}
        drafts={reviewRows}
        applying={applying}
        sourceLabel={reviewSource}
        onChange={setReviewRows}
        onApply={() => void applyReview()}
        onDismiss={() => {
          setReviewOpen(false);
          setReviewRows([]);
        }}
      />
    </div>
  );
}
