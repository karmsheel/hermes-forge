"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2, Save, Trash2 } from "lucide-react";
import {
  CONTENT_CHANNEL_LABELS,
  CONTENT_CHANNELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  emptyContentHealth,
  type ContentChannel,
  type ContentHealthCounts,
  type ContentStatus,
} from "@/lib/content-types";

export type ContentListItem = {
  id: string;
  title: string;
  bodyMarkdown: string;
  status: string;
  channel: string | null;
  source: string;
  processId: string | null;
  automationId: string | null;
  scheduledFor: string | null;
  shippedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ContentStudio({
  businessId,
}: {
  businessId: string | null;
  businessName?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ContentListItem[]>([]);
  const [health, setHealth] = useState<ContentHealthCounts>(emptyContentHealth());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftStatus, setDraftStatus] = useState<ContentStatus>("idea");
  const [draftChannel, setDraftChannel] = useState<ContentChannel | "">("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => items.find((d) => d.id === selectedId) ?? null,
    [items, selectedId],
  );

  const dirty = useMemo(() => {
    if (!selected) return false;
    return (
      draftTitle !== selected.title ||
      draftBody !== selected.bodyMarkdown ||
      draftStatus !== selected.status ||
      (draftChannel || null) !== (selected.channel || null)
    );
  }, [selected, draftTitle, draftBody, draftStatus, draftChannel]);

  const loadItems = useCallback(async () => {
    const qs = statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
    const res = await fetch(`/api/content${qs}`);
    if (res.status === 401) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      toast.error("Could not load content");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const list: ContentListItem[] = data.items || [];
    setItems(list);
    setHealth(data.health || emptyContentHealth());
    setSelectedId((prev) => {
      if (prev && list.some((d) => d.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    setLoading(false);
  }, [router, statusFilter]);

  useEffect(() => {
    if (!businessId) {
      setItems([]);
      setSelectedId(null);
      setHealth(emptyContentHealth());
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadItems();
  }, [businessId, loadItems]);

  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftBody("");
      setDraftStatus("idea");
      setDraftChannel("");
      return;
    }
    setDraftTitle(selected.title);
    setDraftBody(selected.bodyMarkdown);
    setDraftStatus(
      (CONTENT_STATUSES as readonly string[]).includes(selected.status)
        ? (selected.status as ContentStatus)
        : "idea",
    );
    setDraftChannel(
      selected.channel && (CONTENT_CHANNELS as readonly string[]).includes(selected.channel)
        ? (selected.channel as ContentChannel)
        : "",
    );
  }, [selected]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled piece",
          status: "idea",
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const item = await res.json();
      toast.success("Content piece created");
      setStatusFilter("all");
      await loadItems();
      setSelectedId(item.id);
    } catch {
      toast.error("Could not create content");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim() || "Untitled piece",
          bodyMarkdown: draftBody,
          status: draftStatus,
          channel: draftChannel || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Saved");
      await loadItems();
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.title}”?`)) return;
    try {
      const res = await fetch(`/api/content/${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      setSelectedId(null);
      await loadItems();
    } catch {
      toast.error("Could not delete");
    }
  }

  if (!businessId) {
    return (
      <p className="text-sm text-text-muted">
        Select a business to manage content inventory.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading content…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {(["total", ...CONTENT_STATUSES] as const).map((key) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-bg-panel px-3 py-2"
          >
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              {key === "total" ? "Total" : CONTENT_STATUS_LABELS[key]}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {key === "total" ? health.total : health[key]}
            </div>
          </div>
        ))}
      </div>

      <div className="grid min-h-[28rem] gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="flex flex-col rounded-xl border border-border bg-bg-panel">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <select
              className="input flex-1 text-xs py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary text-xs px-2 py-1.5"
              onClick={() => void handleCreate()}
              disabled={creating}
              title="New piece"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FilePlus2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {items.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-text-muted">
                No pieces yet. Create one, or paste drafts from Hermes cron
                deliveries.
              </li>
            )}
            {items.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-accent-tint text-text"
                        : "text-text-muted hover:bg-bg-subtle hover:text-text"
                    }`}
                  >
                    <div className="font-medium truncate">{item.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
                      <span>{CONTENT_STATUS_LABELS[item.status as ContentStatus] ?? item.status}</span>
                      <span>·</span>
                      <span>{formatUpdated(item.updatedAt)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex flex-col rounded-xl border border-border bg-bg-panel">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
              Select or create a content piece.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <input
                  className="input flex-1 min-w-[12rem] text-sm font-medium"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Title"
                />
                <select
                  className="input text-xs py-1.5 w-auto"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as ContentStatus)}
                >
                  {CONTENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONTENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <select
                  className="input text-xs py-1.5 w-auto"
                  value={draftChannel}
                  onChange={(e) =>
                    setDraftChannel(e.target.value as ContentChannel | "")
                  }
                >
                  <option value="">No channel</option>
                  {CONTENT_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CONTENT_CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary text-xs flex items-center gap-1.5"
                  disabled={!dirty || saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs flex items-center gap-1.5"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                className="input flex-1 min-h-[20rem] resize-y rounded-none border-0 font-mono text-sm leading-relaxed"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Draft body (markdown)…"
              />
              <div className="border-t border-border px-3 py-2 text-[10px] text-text-muted">
                Source: {selected.source}
                {selected.shippedAt
                  ? ` · Shipped ${formatUpdated(selected.shippedAt)}`
                  : ""}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
