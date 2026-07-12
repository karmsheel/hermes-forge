"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FilePlus2,
  FileUp,
  Loader2,
  Pin,
  PinOff,
  Save,
  Trash2,
} from "lucide-react";
import { MarkdownDocumentView } from "@/components/documents/MarkdownDocumentView";
import { documentKindLabel } from "@/lib/document-kinds";

export type DocumentListItem = {
  id: string;
  title: string;
  kind: string;
  slug: string;
  bodyMarkdown: string;
  pinnedForContext: boolean;
  sortOrder: number;
  source: string;
  lifecycleStatus?: string;
  forgedAt?: string | null;
  updatedAt: string;
  createdAt: string;
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

export function DocumentsStudio({
  businessId,
  businessName,
}: {
  businessId: string | null;
  businessName: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const selected = useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const dirty = useMemo(() => {
    if (!selected || !editing) return false;
    return draftTitle !== selected.title || draftBody !== selected.bodyMarkdown;
  }, [selected, editing, draftTitle, draftBody]);

  const loadDocuments = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.status === 401) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      toast.error("Could not load documents");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const list: DocumentListItem[] = data.documents || [];
    setDocuments(list);
    setSelectedId((prev) => {
      if (prev && list.some((d) => d.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!businessId) {
      setDocuments([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadDocuments();
  }, [businessId, loadDocuments]);

  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftBody("");
      setEditing(false);
      return;
    }
    setDraftTitle(selected.title);
    setDraftBody(selected.bodyMarkdown);
    setEditing(false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset draft on selection only

  const saveDocument = async () => {
    if (!selected) return;
    const isForged = selected.lifecycleStatus === "forged";
    if (isForged) {
      const ok = window.confirm(
        "This document is forged live business knowledge. Saving will update live documentation and record a decision. Continue?"
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim() || selected.title,
          bodyMarkdown: draftBody,
          actor: "human",
          confirmLiveEdit: isForged,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "save failed");
      }
      const updated = await res.json();
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
      );
      setEditing(false);
      toast.success("Document saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save document");
    } finally {
      setSaving(false);
    }
  };

  const forgeDocument = async () => {
    if (!selected || selected.lifecycleStatus === "forged") return;
    const ok = window.confirm(
      `Forge “${selected.title}” as live business knowledge? Future agent edits will require your approval.`
    );
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${selected.id}/forge`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "forge failed");
      }
      const updated = await res.json();
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
      );
      toast.success("Document forged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not forge document");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (doc: DocumentListItem) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedForContext: !doc.pinnedForContext }),
      });
      if (!res.ok) throw new Error("pin failed");
      const updated = await res.json();
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
      );
      toast.success(
        updated.pinnedForContext
          ? "Pinned for Hermes context"
          : "Unpinned from default context",
      );
    } catch {
      toast.error("Could not update pin");
    }
  };

  const createBlank = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New note",
          kind: "freeform",
          bodyMarkdown: "# New note\n\n",
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const doc = await res.json();
      setDocuments((prev) => [...prev, doc]);
      setSelectedId(doc.id);
      setEditing(true);
      setDraftTitle(doc.title);
      setDraftBody(doc.bodyMarkdown);
      toast.success("Note created");
    } catch {
      toast.error("Could not create document");
    } finally {
      setCreating(false);
    }
  };

  const deleteDocument = async (doc: DocumentListItem) => {
    if (doc.slug === "basics") {
      toast.error("Basics cannot be deleted — edit its content instead");
      return;
    }
    if (!window.confirm(`Delete “${doc.title}”? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "delete failed");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Document deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const onImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          bodyMarkdown: text,
        }),
      });
      if (!res.ok) throw new Error("import failed");
      const doc = await res.json();
      setDocuments((prev) => [...prev, doc]);
      setSelectedId(doc.id);
      toast.success(`Imported “${doc.title}”`);
    } catch {
      toast.error("Could not import file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!businessId) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-8 text-center text-sm text-text-muted">
        Select or create a business to manage knowledge documents.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading documents…
      </div>
    );
  }

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-4 lg:flex-row lg:items-stretch">
      {/* List */}
      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-bg-panel lg:w-72">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <button
            type="button"
            onClick={() => void createBlank()}
            disabled={creating}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
            New note
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import markdown"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text hover:bg-bg-muted disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileUp className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
            }}
          />
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {documents.map((doc) => {
            const active = doc.id === selectedId;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (dirty && !window.confirm("Discard unsaved changes?")) return;
                    setSelectedId(doc.id);
                  }}
                  className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-accent-tint text-text-strong"
                      : "hover:bg-bg-muted text-text"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {doc.pinnedForContext && (
                      <Pin className="h-3 w-3 shrink-0 text-accent" aria-hidden />
                    )}
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="mt-0.5 text-[11px] text-text-muted">
                    {documentKindLabel(doc.kind)}
                    {doc.slug === "basics" ? " · always in context" : ""}
                  </span>
                </button>
              </li>
            );
          })}
          {documents.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-text-muted">
              No documents yet.
            </li>
          )}
        </ul>
        {businessName && (
          <p className="border-t border-border px-3 py-2 text-[10px] text-text-faint">
            Pinned docs feed Hermes when mapping processes
          </p>
        )}
      </aside>

      {/* Viewer / editor */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-bg-panel">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-text-muted">
            Select a document to view.
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-lg font-semibold text-text-strong outline-none focus:border-accent"
                  />
                ) : (
                  <h2 className="truncate text-xl font-semibold tracking-tight text-text-strong">
                    {selected.title}
                  </h2>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {documentKindLabel(selected.kind)} · updated{" "}
                  {formatUpdated(selected.updatedAt)}
                  {selected.pinnedForContext || selected.slug === "basics"
                    ? " · used as Hermes context"
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void togglePin(selected)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text hover:bg-bg-muted"
                  title={
                    selected.pinnedForContext
                      ? "Unpin from Hermes context"
                      : "Pin for Hermes context"
                  }
                >
                  {selected.pinnedForContext ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                  {selected.pinnedForContext ? "Unpin" : "Pin"}
                </button>
                {editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftTitle(selected.title);
                        setDraftBody(selected.bodyMarkdown);
                        setEditing(false);
                      }}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text hover:bg-bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveDocument()}
                      disabled={saving || !dirty}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    {selected.lifecycleStatus !== "forged" && (
                      <button
                        type="button"
                        onClick={() => void forgeDocument()}
                        disabled={saving}
                        className="rounded-lg border border-accent/40 px-2.5 py-1.5 text-xs text-accent hover:bg-accent/10"
                        title="Lock as live business knowledge"
                      >
                        Forge
                      </button>
                    )}
                    {selected.lifecycleStatus === "forged" && (
                      <span className="text-[10px] uppercase tracking-widest text-green px-2 py-1.5">
                        Forged
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                    >
                      Edit
                    </button>
                  </>
                )}
                {selected.slug !== "basics" && (
                  <button
                    type="button"
                    onClick={() => void deleteDocument(selected)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-red hover:bg-red-bg"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              {editing ? (
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  spellCheck
                  className="min-h-[480px] w-full resize-y rounded-lg border border-border bg-bg-elevated p-4 font-mono text-sm leading-relaxed text-text outline-none focus:border-accent"
                  placeholder="Write markdown…"
                />
              ) : (
                <MarkdownDocumentView markdown={selected.bodyMarkdown} />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
