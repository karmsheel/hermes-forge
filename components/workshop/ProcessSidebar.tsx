"use client";

import { useState } from "react";
import { Plus, GitBranch, Loader2, Pencil, Check, X } from "lucide-react";
import type { ProcessSummary } from "@/lib/types";

interface ProcessSidebarProps {
  processes: ProcessSummary[];
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => Promise<void>;
}

export function ProcessSidebar({
  processes,
  activeId,
  loading,
  creating,
  onSelect,
  onCreate,
  onRename,
}: ProcessSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(proc: ProcessSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(proc.id);
    setEditName(proc.name);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(procId: string, e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await onRename(procId, editName.trim());
      setEditingId(null);
      setEditName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg-panel text-text flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreate}
          disabled={creating}
          className="btn-primary w-full justify-center text-sm py-2"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Process
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="text-[10px] uppercase tracking-widest text-text-muted px-2 mb-2">
          Workflows
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-text-soft" />
          </div>
        ) : processes.length === 0 ? (
          <div className="text-xs text-text-muted px-2 py-4 text-center">
            No workflows yet. Create one to start mapping.
          </div>
        ) : (
          <ul className="space-y-1">
            {processes.map((proc) => {
              const isActive = proc.id === activeId;
              const isEditing = editingId === proc.id;
              const hasDiagram = !!proc.diagramMermaid;

              return (
                <li key={proc.id}>
                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveEdit(proc.id, e)}
                      className="px-3 py-2.5 rounded-xl bg-bg-muted border border-border-strong"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        className="input w-full text-sm py-1.5 mb-2"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        disabled={saving}
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="submit"
                          disabled={saving || !editName.trim()}
                          className="p-1.5 rounded-lg hover:bg-bg-subtle text-green"
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(proc.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onSelect(proc.id);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                        isActive
                          ? "bg-bg-muted border border-border-strong"
                          : "hover:bg-bg-subtle border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GitBranch
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            hasDiagram ? "text-green" : "text-text-soft"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium truncate flex-1">
                              {proc.name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => startEdit(proc, e)}
                              className="p-1 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text shrink-0"
                              title="Rename workflow"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                          {proc.description && (
                            <div className="text-[11px] text-text-muted truncate mt-0.5">
                              {proc.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-px rounded bg-bg-muted text-text-muted">
                              {proc.department}
                            </span>
                            <span className="text-[10px] text-text-soft">
                              {proc._count.messages} msgs
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}