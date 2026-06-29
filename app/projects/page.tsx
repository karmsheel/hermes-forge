"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, Plus, ArrowRight, Loader2, LogOut, User, Pencil, Check, X } from "lucide-react";
import type { BusinessSummary, UserProfile } from "@/lib/types";

export default function BusinessesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<BusinessSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

      setUser(me.user);
      setProjects(biz.businesses || []);
      setActiveProjectId(me.activeBusiness?.id || null);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function startProject() {
    setCreating(true);

    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create");
      const project = await res.json();
      setActiveProjectId(project.id);
      router.push("/workshop");
    } catch {
      toast.error("Could not create project");
    } finally {
      setCreating(false);
    }
  }

  async function selectProject(id: string) {
    try {
      const res = await fetch("/api/businesses/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (!res.ok) throw new Error("Failed");
      setActiveProjectId(id);
      router.push("/workshop");
    } catch {
      toast.error("Could not open project");
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
              <span className="text-black font-bold text-sm">H</span>
            </div>
            <span className="font-semibold">Hermes Forge</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/profile" className="text-zinc-400 hover:text-white flex items-center gap-1">
              <User className="w-4 h-4" />
              {user?.name || user?.email}
            </Link>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-white flex items-center gap-1">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Your workspace</div>
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-zinc-500 mt-2">
              Each project contains its own workflows and diagrams.
            </p>
          </div>
          <button
            onClick={() => startProject()}
            disabled={creating}
            className="btn-primary text-sm"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div className="card p-10 text-center border-dashed">
            <FolderKanban className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 mb-4">
              Start mapping workflows — your project name and details will emerge as you chat with Hermes.
            </p>
            <button
              onClick={() => startProject()}
              disabled={creating}
              className="btn-primary inline-flex"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
                      <FolderKanban className="w-5 h-5 text-emerald-400 shrink-0" />
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
                        className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !editName.trim()}
                        className="p-2 rounded-lg hover:bg-zinc-800 text-emerald-400"
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
                      className={`card w-full p-5 text-left hover:border-zinc-600 transition-colors flex items-center justify-between group cursor-pointer ${
                        activeProjectId === project.id ? "border-emerald-500/40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <FolderKanban className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-lg truncate">{project.name}</span>
                            <button
                              type="button"
                              onClick={(e) => startEdit(project, e)}
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 shrink-0"
                              title="Rename project"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {project.description && (
                            <div className="text-sm text-zinc-500 mt-0.5 line-clamp-1">
                              {project.description}
                            </div>
                          )}
                          <div className="text-xs text-zinc-600 mt-2">
                            {project._count.processes} workflow
                            {project._count.processes !== 1 ? "s" : ""}
                            {project.industry && ` · ${project.industry}`}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors shrink-0 ml-3" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}