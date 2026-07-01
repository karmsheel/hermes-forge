"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, LogOut, Pencil, Trash2, Upload } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessSummary, BusinessExportPayload, UserProfile } from "@/lib/types";
import { buildBusinessExportPayload, createBusinessExportZip, downloadBlob, makeExportFilename } from "@/lib/business-export";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { currentBusiness, switchBusiness, refreshCurrentBusiness } = useShell();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setName(data.user?.name || "");
      })
      .finally(() => setLoading(false));

    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setBizLoading(true);
    try {
      const res = await fetch("/api/businesses");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch {
      // non-fatal for list
    } finally {
      setBizLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setUser(updated);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function handleDownload(biz: BusinessSummary) {
    setDownloadingId(biz.id);
    try {
      // 1. Get business metadata + processes list (basic)
      const bizRes = await fetch(`/api/businesses/${biz.id}`);
      if (!bizRes.ok) throw new Error("Failed to load business");
      const fullBiz = await bizRes.json();

      // 2. For each process, fetch with messages
      const procs = (fullBiz?.processes || []) as any[];
      const processesWithMessages = await Promise.all(
        procs.map(async (p: any) => {
          const r = await fetch(`/api/processes/${p.id}`);
          if (!r.ok) return null;
          const full = await r.json();
          return {
            name: full.name,
            description: full.description,
            department: full.department,
            trigger: full.trigger,
            inputs: full.inputs,
            outputs: full.outputs,
            manualSteps: full.manualSteps,
            diagramMermaid: full.diagramMermaid,
            messages: (full.messages || []).map((m: any) => ({
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          };
        })
      );

      const validProcesses = processesWithMessages.filter(Boolean) as any[];

      const payload = buildBusinessExportPayload({
        business: {
          name: fullBiz.name || biz.name,
          description: fullBiz.description ?? biz.description,
          industry: fullBiz.industry ?? biz.industry,
        },
        processes: validProcesses,
        memories: fullBiz.memories,
      });

      const blob = await createBusinessExportZip(payload, biz.name);
      const filename = makeExportFilename(biz.name);
      await downloadBlob(blob, filename);

      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to export business as ZIP");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("export.json");
      if (!jsonFile) {
        throw new Error("export.json not found in zip");
      }
      const jsonText = await jsonFile.async("string");
      const payload: BusinessExportPayload = JSON.parse(jsonText);

      const res = await fetch("/api/businesses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Import failed");
      }
      const created = await res.json();

      toast.success(`Imported business: ${created.business?.name || "New business"}`);
      await loadBusinesses();
    } catch (e: any) {
      toast.error(e?.message || "Failed to import business");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleImportFile(f);
  }

  function openEdit(biz: BusinessSummary) {
    setEditTarget({ id: biz.id, name: biz.name });
    setEditName(biz.name);
  }

  async function confirmEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    if (trimmed === editTarget.name) {
      setEditTarget(null);
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/businesses/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }

      setBusinesses((prev) =>
        prev.map((b) => (b.id === editTarget.id ? { ...b, name: trimmed } : b))
      );
      setEditTarget(null);
      toast.success("Business renamed");

      if (currentBusiness?.id === editTarget.id) {
        await refreshCurrentBusiness();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to rename business");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      toast.success(`Deleted business: ${name}`);
      setDeleteConfirm(null);

      // Refresh list
      const listRes = await fetch("/api/businesses");
      const listData = await listRes.json();
      const newList = listData.businesses || [];
      setBusinesses(newList);

      // If we deleted the active business, handle it
      if (currentBusiness?.id === id) {
        if (newList.length > 0) {
          await switchBusiness(newList[0].id);
          toast.info("Switched to another business");
        } else {
          await refreshCurrentBusiness();
          router.refresh();
          router.push("/home");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete business");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted w-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

        <form onSubmit={handleSave} className="card p-6 space-y-4 mb-8">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">Email</label>
            <div className="mt-1 text-sm text-text">{user?.email}</div>
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">Name</label>
            <input
              className="input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="text-xs text-text-soft">
            {user?._count?.businesses ?? 0} business{(user?._count?.businesses ?? 0) !== 1 ? "es" : ""}
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </button>
        </form>

        {/* Businesses management */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted">Your Businesses</div>
            <div className="text-sm text-text-muted">Each business contains its workflows and diagrams.</div>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={onFileChange}
              disabled={importing}
            />
            <button
              onClick={triggerImport}
              disabled={importing}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing..." : "Import business (ZIP)"}
            </button>
          </div>
        </div>

        {bizLoading ? (
          <div className="text-center py-8 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="card p-6 text-sm text-text-muted">No businesses yet. Create one from the header or + button.</div>
        ) : (
          <ul className="space-y-3 mb-8">
            {businesses.map((b) => (
              <li key={b.id} className="card p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.name}</div>
                  {b.description && (
                    <div className="text-sm text-text-muted line-clamp-1 mt-0.5">{b.description}</div>
                  )}
                  <div className="text-xs text-text-soft mt-1">
                    {b._count?.processes ?? 0} workflow{(b._count?.processes ?? 0) !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(b)}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                    title="Edit name"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <Link href="/projects" className="btn-secondary text-xs px-3 py-1.5">Open</Link>
                  <button
                    onClick={() => handleDownload(b)}
                    disabled={downloadingId === b.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                    title="Download as ZIP"
                  >
                    {downloadingId === b.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">ZIP</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: b.id, name: b.name })}
                    disabled={deletingId === b.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 text-red-400 hover:text-red-300"
                    title="Delete business"
                  >
                    {deletingId === b.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={handleLogout}
          className="w-full btn-secondary flex items-center justify-center gap-2 text-red-400 hover:text-red-300"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>

        {/* Edit business dialog */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close edit dialog"
              onClick={() => !savingEdit && setEditTarget(null)}
              disabled={savingEdit}
            />
            <form onSubmit={confirmEdit} className="relative w-full max-w-md card p-6">
              <h2 className="text-xl font-semibold tracking-tight">Rename Business</h2>
              <p className="text-sm text-text-muted mt-2">
                Change the display name for this business.
              </p>
              <input
                className="input w-full mt-4"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Business name"
                maxLength={120}
                autoFocus
                disabled={savingEdit}
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  disabled={savingEdit}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editName.trim()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close delete confirmation"
              onClick={() => !deletingId && setDeleteConfirm(null)}
              disabled={!!deletingId}
            />
            <div className="relative w-full max-w-md card p-6">
              <h2 className="text-xl font-semibold tracking-tight">Delete Business?</h2>
              <p className="text-sm text-text-muted mt-2">
                This will permanently delete <span className="font-medium text-text">"{deleteConfirm.name}"</span> and all its workflows, diagrams, chats, and data.
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={!!deletingId}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={!!deletingId}
                  className="btn-primary text-sm bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:opacity-50"
                >
                  {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Business"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
