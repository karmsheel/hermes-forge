"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, Plus, ArrowRight, Loader2, Pencil, Check, X } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { clearLegacyActiveProcessId } from "@/lib/workshop-storage";
import type { BusinessSummary } from "@/lib/types";

export default function BusinessesPage() {
  const router = useRouter();
  const { openNewProject } = useShell();
  const [projects, setProjects] = useState<BusinessSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, bizRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/businesses"),
      ]);

      if (meRes.status === 401) {
        router.push("/login");
        return;
      }

      const me = await meRes.json();
      const biz = await bizRes.json();

      setProjects(biz.businesses || []);
      setActiveProjectId(me.activeBusiness?.id || null);
    } catch {
      toast.error("Failed to load functions");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectProject(id: string) {
    try {
      const res = await fetch("/api/businesses/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (!res.ok) throw new Error("Failed");
      clearLegacyActiveProcessId();
      setActiveProjectId(id);
      router.push("/workshop");
    } catch {
      toast.error("Could not open function");
    }
  }

  function startEdit(project: BusinessSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.name);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
    setEditName("");
  }

  async function saveRename(projectId: string, e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: updated.name } : p))
      );
      setEditingId(null);
      setEditName("");
      toast.success("Project renamed");
    } catch {
      toast.error("Could not rename project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Your workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight">Functions</h1>
          <p className="text-sm text-text-muted mt-2">
            Each function contains its own workflows and diagrams. Workflows are auto-categorized on creation.
          </p>
        </div>
        <button onClick={openNewProject} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New Function
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <FolderKanban className="w-10 h-10 text-text-soft mx-auto mb-3" />
          <p className="text-text-muted mb-4">
            Create a function to start mapping workflows with Hermes.
          </p>
          <button onClick={openNewProject} className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Get started
          </button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => {
            const isEditing = editingId === project.id;

            return (
              <li key={project.id}>
                {isEditing ? (
                  <form
                    onSubmit={(e) => saveRename(project.id, e)}
                    className="card p-5 flex gap-3 items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderKanban className="w-5 h-5 text-accent shrink-0" />
                    <input
                      className="input flex-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !editName.trim()}
                      className="p-2 rounded-lg hover:bg-bg-subtle text-green"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") selectProject(project.id);
                    }}
                    className={`card w-full p-5 text-left transition-colors flex items-center justify-between group cursor-pointer ${
                      activeProjectId === project.id ? "border-green-border" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center shrink-0">
                        <FolderKanban className="w-5 h-5 text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg truncate">{project.name}</span>
                          <button
                            type="button"
                            onClick={(e) => startEdit(project, e)}
                            className="p-1.5 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text shrink-0"
                            title="Rename function"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {project.description && (
                          <div className="text-sm text-text-muted mt-0.5 line-clamp-1">
                            {project.description}
                          </div>
                        )}
                        <div className="text-xs text-text-soft mt-2">
                          {project._count.processes} workflow
                          {project._count.processes !== 1 ? "s" : ""}
                          {project.industry && ` · ${project.industry}`}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-text-soft group-hover:text-text-strong transition-colors shrink-0 ml-3" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}