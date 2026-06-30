"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, GitBranch, Loader2, Building2, Pencil, Check, X } from "lucide-react";
import type { ProcessSummary } from "@/lib/types";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";

interface ProcessSidebarProps {
  processes: ProcessSummary[];
  activeId: string | null;
  businessName: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => Promise<void>;
}

export function ProcessSidebar({
  processes,
  activeId,
  businessName,
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
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <span className="text-black font-bold text-sm">H</span>
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight">Hermes Forge</div>
            <div className="text-[10px] text-zinc-500">Process Workshop</div>
          </div>
        </div>
        {businessName && (
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-400 mt-2 truncate transition-colors"
            title="Switch project"
          >
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{businessName}</span>
          </Link>
        )}
      </div>

      <div className="p-3">
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
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 px-2 mb-2">
          Workflows
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
          </div>
        ) : processes.length === 0 ? (
          <div className="text-xs text-zinc-500 px-2 py-4 text-center">
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
                      className="px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700"
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
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="submit"
                          disabled={saving || !editName.trim()}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-emerald-400"
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
                          ? "bg-zinc-800 border border-zinc-700"
                          : "hover:bg-zinc-900 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GitBranch
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            hasDiagram ? "text-emerald-400" : "text-zinc-600"
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
                              className="p-1 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 shrink-0"
                              title="Rename workflow"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                          {proc.description && (
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {proc.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-1.5 py-px rounded bg-zinc-800 text-zinc-400">
                              {proc.department}
                            </span>
                            {proc.status === "approved" && (
                              <span className="text-[10px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-400">
                                {PROCESS_STATUS_LABELS.approved}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-600">
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