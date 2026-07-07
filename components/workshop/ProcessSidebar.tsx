"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  GitBranch,
  Loader2,
  Check,
  X,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { FunctionSummary } from "@/lib/functions";
import type { ProcessSummary } from "@/lib/types";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { FunctionFilterPicker } from "./FunctionFilterPicker";

interface ProcessSidebarProps {
  processes: ProcessSummary[];
  functions: FunctionSummary[];
  functionFilter: string | null;
  onFunctionFilterChange: (functionName: string | null) => void;
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ProcessSidebar({
  processes,
  functions,
  functionFilter,
  onFunctionFilterChange,
  activeId,
  loading,
  creating,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ProcessSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const POPOVER_WIDTH = 168;

  const closeMenu = useCallback(() => {
    menuTriggerRef.current = null;
    setOpenMenuId(null);
    setMenuAnchor(null);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuTriggerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, openMenuId]);

  function startEdit(proc: ProcessSummary) {
    closeMenu();
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

  function toggleMenu(procId: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (openMenuId === procId) {
      menuTriggerRef.current = null;
      closeMenu();
      return;
    }
    menuTriggerRef.current = e.currentTarget;
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - POPOVER_WIDTH),
    });
    setOpenMenuId(procId);
  }

  function requestDelete(proc: ProcessSummary) {
    closeMenu();
    setDeleteConfirm({ id: proc.id, name: proc.name });
  }

  const openMenuProcess = openMenuId
    ? processes.find((proc) => proc.id === openMenuId) ?? null
    : null;

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await onDelete(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete workflow");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <aside className="w-64 shrink-0 border-r border-border bg-bg-panel text-text flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
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
          <FunctionFilterPicker
            value={functionFilter}
            functions={functions}
            onChange={onFunctionFilterChange}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted px-2 mb-2">
            {functionFilter ? `${functionFilter} workflows` : "Workflows"}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-text-soft" />
            </div>
          ) : processes.length === 0 ? (
            <div className="text-xs text-text-muted px-2 py-4 text-center">
              {functionFilter
                ? `No workflows in ${functionFilter} yet.`
                : "No workflows yet. Create one to start mapping."}
            </div>
          ) : (
            <ul className="space-y-1">
              {processes.map((proc) => {
                const isActive = proc.id === activeId;
                const isEditing = editingId === proc.id;
                const hasDiagram = !!proc.diagramMermaid;
                const isMenuOpen = openMenuId === proc.id;

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
                              <div className="workflow-menu shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => toggleMenu(proc.id, e)}
                                  className={`workflow-menu__trigger p-1 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text ${
                                    isMenuOpen ? "is-open" : ""
                                  }`}
                                  title="Workflow options"
                                  aria-label={`Options for ${proc.name}`}
                                  aria-haspopup="menu"
                                  aria-expanded={isMenuOpen}
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {proc.description && (
                              <div className="text-[11px] text-text-muted truncate mt-0.5">
                                {proc.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-px rounded bg-bg-muted text-text-muted">
                                {proc.department}
                              </span>
                              {proc.status === "approved" && (
                                <span className="pill pill-green text-[10px]">
                                  {PROCESS_STATUS_LABELS.approved}
                                </span>
                              )}
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

      {openMenuProcess && menuAnchor && (
        <div
          ref={menuRef}
          className="workflow-menu__popover workflow-menu__popover--fixed"
          role="menu"
          aria-label={`Options for ${openMenuProcess.name}`}
          style={{ top: menuAnchor.top, left: menuAnchor.left, width: POPOVER_WIDTH }}
        >
          <button
            type="button"
            role="menuitem"
            className="workflow-menu__item"
            onClick={(e) => {
              e.stopPropagation();
              startEdit(openMenuProcess);
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="workflow-menu__item workflow-menu__item--danger"
            onClick={(e) => {
              e.stopPropagation();
              requestDelete(openMenuProcess);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete workflow
          </button>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close delete confirmation"
            onClick={() => !deleting && setDeleteConfirm(null)}
            disabled={deleting}
          />
          <div className="relative w-full max-w-md card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Delete workflow?</h2>
            <p className="text-sm text-text-muted mt-2">
              This will permanently delete{" "}
              <span className="font-medium text-text">&quot;{deleteConfirm.name}&quot;</span> and
              all its diagrams, chats, and conversations. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Delete workflow"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}