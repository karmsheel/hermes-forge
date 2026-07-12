"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CloudUpload,
  Download,
  GitBranch,
  Loader2,
  LogOut,
  Pencil,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import type { BusinessGitStatus } from "@/lib/business-git";
import { SignInOptions } from "@/components/auth/SignInOptions";
import { useShell } from "@/components/shell/ShellContext";
import { isLocalUserEmail } from "@/lib/local-user-email";
import type { BusinessSummary, BusinessExportPayload, UserProfile } from "@/lib/types";
import { buildBusinessExportPayload, createBusinessExportZip, downloadBlob, makeExportFilename } from "@/lib/business-export";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [syncingGitId, setSyncingGitId] = useState<string | null>(null);
  const [pushingGitId, setPushingGitId] = useState<string | null>(null);
  const [gitStatusById, setGitStatusById] = useState<Record<string, BusinessGitStatus>>({});
  const [gitPanelId, setGitPanelId] = useState<string | null>(null);
  const [remoteDraftById, setRemoteDraftById] = useState<Record<string, { url: string; branch: string }>>({});
  const [savingRemoteId, setSavingRemoteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingGit, setImportingGit] = useState(false);
  const [gitImportOpen, setGitImportOpen] = useState(false);
  const [gitImportMode, setGitImportMode] = useState<"path" | "remote">("remote");
  const [gitImportPath, setGitImportPath] = useState("");
  const [gitImportRemote, setGitImportRemote] = useState("");
  const [gitImportBranch, setGitImportBranch] = useState("main");
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
        router.push("/");
        return;
      }
      const data = await res.json();
      const list: BusinessSummary[] = data.businesses || [];
      setBusinesses(list);
      void loadGitStatuses(list);
    } catch {
      // non-fatal for list
    } finally {
      setBizLoading(false);
    }
  }

  async function loadGitStatuses(list: BusinessSummary[]) {
    const entries = await Promise.all(
      list.map(async (b) => {
        try {
          const res = await fetch(`/api/businesses/${b.id}/git`);
          if (!res.ok) return null;
          const status = (await res.json()) as BusinessGitStatus;
          return [b.id, status] as const;
        } catch {
          return null;
        }
      })
    );
    const next: Record<string, BusinessGitStatus> = {};
    for (const entry of entries) {
      if (entry) next[entry[0]] = entry[1];
    }
    setGitStatusById(next);
  }

  function gitLabel(status: BusinessGitStatus | undefined): string {
    if (!status) return "";
    if (!status.gitAvailable) return "Git unavailable";
    if (!status.initialized) return "Git not initialized";
    if (status.dirty) return "Git out of date";
    if (status.lastPushError) return "Push failed";
    if (status.remoteUrl && status.lastPushedAt) return "Git synced · pushed";
    if (status.remoteUrl) return "Git synced · not pushed";
    return "Git synced (local)";
  }

  async function refreshGitStatus(businessId: string) {
    const statusRes = await fetch(`/api/businesses/${businessId}/git`);
    if (!statusRes.ok) return;
    const status = (await statusRes.json()) as BusinessGitStatus;
    setGitStatusById((prev) => ({ ...prev, [businessId]: status }));
    setRemoteDraftById((prev) => ({
      ...prev,
      [businessId]: {
        url: status.remoteUrl ?? prev[businessId]?.url ?? "",
        branch: status.remoteBranch ?? prev[businessId]?.branch ?? "main",
      },
    }));
  }

  async function handleGitSync(business: BusinessSummary) {
    setSyncingGitId(business.id);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Git sync failed");
      toast.success(data.committed ? `Synced to Git (${data.message})` : data.message);
      await refreshGitStatus(business.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Git sync failed";
      toast.error(message);
    } finally {
      setSyncingGitId(null);
    }
  }

  async function handleGitPush(business: BusinessSummary, syncFirst: boolean) {
    setPushingGitId(business.id);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: syncFirst ? "sync_and_push" : "push" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Git push failed");
      toast.success(data.message || "Pushed to remote");
      await refreshGitStatus(business.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Git push failed";
      toast.error(message);
      await refreshGitStatus(business.id);
    } finally {
      setPushingGitId(null);
    }
  }

  function openGitPanel(business: BusinessSummary) {
    const status = gitStatusById[business.id];
    setGitPanelId((prev) => (prev === business.id ? null : business.id));
    setRemoteDraftById((prev) => ({
      ...prev,
      [business.id]: {
        url: prev[business.id]?.url ?? status?.remoteUrl ?? "",
        branch: prev[business.id]?.branch ?? status?.remoteBranch ?? "main",
      },
    }));
  }

  async function handleSaveRemote(business: BusinessSummary) {
    const draft = remoteDraftById[business.id] ?? { url: "", branch: "main" };
    setSavingRemoteId(business.id);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteUrl: draft.url.trim() || null,
          remoteBranch: draft.branch.trim() || "main",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save remote");
      toast.success(data.note || "Remote saved");
      await refreshGitStatus(business.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save remote");
    } finally {
      setSavingRemoteId(null);
    }
  }

  async function handleGitImport(e: React.FormEvent) {
    e.preventDefault();
    setImportingGit(true);
    try {
      const body =
        gitImportMode === "path"
          ? { repoPath: gitImportPath.trim() }
          : {
              remoteUrl: gitImportRemote.trim(),
              branch: gitImportBranch.trim() || "main",
            };
      const res = await fetch("/api/businesses/import/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Git import failed");
      toast.success(data.message || `Imported ${data.business?.name || "business"}`);
      setGitImportOpen(false);
      setGitImportPath("");
      setGitImportRemote("");
      await loadBusinesses();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Git import failed");
    } finally {
      setImportingGit(false);
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
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Logout failed");
      toast.success("Signed out");
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
      setLoggingOut(false);
    }
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
      const exportRes = await fetch(`/api/businesses/${id}/log/export`);
      if (!exportRes.ok) {
        const err = await exportRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to export business log archive");
      }
      const bundle = await exportRes.json();
      const archiveBlob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      downloadBlob(archiveBlob, `${name.replace(/[^\w.-]+/g, "_")}-business-log.json`);

      const res = await fetch(`/api/businesses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportChecksum: bundle.checksum }),
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

  const authLabel = isLocalUserEmail(user?.email)
    ? "Local mode (no account)"
    : user?.email || "Signed in";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 w-full">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

        <form onSubmit={handleSave} className="card p-6 space-y-4 mb-8">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">Display name</label>
            <input
              className="input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="text-xs text-text-soft space-y-1">
            <div>
              {user?._count?.businesses ?? 0} business
              {(user?._count?.businesses ?? 0) !== 1 ? "es" : ""}
            </div>
            <div>
              Sign-in: <span className="text-text-muted">{authLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="btn-secondary"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Log out
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sign-in / upgrade options (same choices as first-run sign-in) */}
        <div className="mb-8">
          <div className="mb-3">
            <div className="text-xs uppercase tracking-widest text-text-muted">Sign-in options</div>
            <div className="text-sm text-text-muted">
              Stay local, or add email / GitHub later for lock-down and backup once your business is
              further along.
            </div>
          </div>
          <SignInOptions
            variant="profile"
            currentEmail={user?.email}
            redirectTo="/profile"
            showBrand={false}
          />
        </div>

        {/* Businesses management */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted">Your Businesses</div>
            <div className="text-sm text-text-muted">Each business contains its workflows and diagrams.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={onFileChange}
              disabled={importing || importingGit}
            />
            <button
              onClick={triggerImport}
              disabled={importing || importingGit}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing..." : "Import ZIP"}
            </button>
            <button
              type="button"
              onClick={() => setGitImportOpen((v) => !v)}
              disabled={importing || importingGit}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              Import from Git
            </button>
          </div>
        </div>

        {gitImportOpen && (
          <form onSubmit={handleGitImport} className="card p-4 mb-4 space-y-3">
            <div className="text-sm font-medium">Restore business from Git</div>
            <p className="text-xs text-text-muted">
              Creates a <span className="text-text">new</span> business from a Hermes Forge repo snapshot
              (local path or remote clone). Uses system Git credentials for remotes.
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded border ${
                  gitImportMode === "remote"
                    ? "border-accent text-accent"
                    : "border-stroke text-text-muted"
                }`}
                onClick={() => setGitImportMode("remote")}
              >
                Remote URL
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded border ${
                  gitImportMode === "path"
                    ? "border-accent text-accent"
                    : "border-stroke text-text-muted"
                }`}
                onClick={() => setGitImportMode("path")}
              >
                Local path
              </button>
            </div>
            {gitImportMode === "remote" ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <input
                  className="input text-sm"
                  placeholder="https://github.com/you/business-repo.git"
                  value={gitImportRemote}
                  onChange={(e) => setGitImportRemote(e.target.value)}
                  disabled={importingGit}
                />
                <input
                  className="input text-sm"
                  placeholder="main"
                  value={gitImportBranch}
                  onChange={(e) => setGitImportBranch(e.target.value)}
                  disabled={importingGit}
                />
              </div>
            ) : (
              <input
                className="input text-sm w-full"
                placeholder="C:\Users\you\.hermes-forge\businesses\biz_abc"
                value={gitImportPath}
                onChange={(e) => setGitImportPath(e.target.value)}
                disabled={importingGit}
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setGitImportOpen(false)}
                disabled={importingGit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={
                  importingGit ||
                  (gitImportMode === "remote"
                    ? !gitImportRemote.trim()
                    : !gitImportPath.trim())
                }
              >
                {importingGit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Import business"
                )}
              </button>
            </div>
          </form>
        )}

        {bizLoading ? (
          <div className="text-center py-8 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="card p-6 text-sm text-text-muted">No businesses yet. Create one from the header or + button.</div>
        ) : (
          <ul className="space-y-3 mb-8">
            {businesses.map((b) => {
              const gitStatus = gitStatusById[b.id];
              const gitBusy =
                syncingGitId === b.id ||
                pushingGitId === b.id ||
                savingRemoteId === b.id;
              const draft = remoteDraftById[b.id] ?? {
                url: gitStatus?.remoteUrl ?? "",
                branch: gitStatus?.remoteBranch ?? "main",
              };
              return (
                <li key={b.id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.name}</div>
                      {b.description && (
                        <div className="text-sm text-text-muted line-clamp-1 mt-0.5">
                          {b.description}
                        </div>
                      )}
                      <div className="text-xs text-text-soft mt-1">
                        {b._count?.processes ?? 0} workflow
                        {(b._count?.processes ?? 0) !== 1 ? "s" : ""}
                        {gitStatus && (
                          <>
                            {" · "}
                            {gitLabel(gitStatus)}
                          </>
                        )}
                      </div>
                      {gitStatus?.lastPushError && (
                        <div className="text-xs text-red-400 mt-1 line-clamp-2">
                          {gitStatus.lastPushError}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => void handleGitSync(b)}
                        disabled={gitBusy || gitStatus?.gitAvailable === false}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        title="Materialize and commit to local Git repo"
                      >
                        {syncingGitId === b.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <GitBranch className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Sync</span>
                      </button>
                      <button
                        onClick={() => void handleGitPush(b, true)}
                        disabled={
                          gitBusy ||
                          gitStatus?.gitAvailable === false ||
                          !gitStatus?.remoteUrl
                        }
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        title={
                          gitStatus?.remoteUrl
                            ? "Sync local repo then push to remote"
                            : "Configure a remote first"
                        }
                      >
                        {pushingGitId === b.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CloudUpload className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Push</span>
                      </button>
                      <button
                        onClick={() => openGitPanel(b)}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        title="Git remote settings"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        title="Edit name"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <Link href="/functions" className="btn-secondary text-xs px-3 py-1.5">
                        Open
                      </Link>
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
                  </div>

                  {gitPanelId === b.id && (
                    <div className="rounded-lg border border-stroke bg-bg/40 p-3 space-y-2">
                      <div className="text-xs uppercase tracking-widest text-text-muted">
                        Git backup
                      </div>
                      <p className="text-xs text-text-muted">
                        Local path:{" "}
                        <span className="text-text-soft break-all">
                          {gitStatus?.repoPath || "—"}
                        </span>
                      </p>
                      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                        <input
                          className="input text-sm"
                          placeholder="https://github.com/you/my-business.git"
                          value={draft.url}
                          onChange={(e) =>
                            setRemoteDraftById((prev) => ({
                              ...prev,
                              [b.id]: { ...draft, url: e.target.value },
                            }))
                          }
                          disabled={gitBusy}
                        />
                        <input
                          className="input text-sm"
                          placeholder="main"
                          value={draft.branch}
                          onChange={(e) =>
                            setRemoteDraftById((prev) => ({
                              ...prev,
                              [b.id]: { ...draft, branch: e.target.value },
                            }))
                          }
                          disabled={gitBusy}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          className="btn-secondary text-xs px-3 py-1.5"
                          disabled={gitBusy}
                          onClick={() => void handleSaveRemote(b)}
                        >
                          {savingRemoteId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Save remote"
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs px-3 py-1.5"
                          disabled={
                            gitBusy ||
                            !gitStatus?.remoteUrl ||
                            !gitStatus.initialized
                          }
                          onClick={() => void handleGitPush(b, false)}
                          title="Push current HEAD without re-syncing"
                        >
                          Push only
                        </button>
                      </div>
                      <p className="text-[11px] text-text-soft">
                        Auth uses your system Git credentials (Credential Manager / SSH agent).
                        Forge does not store tokens.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

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
                A business log archive will be downloaded first. This action cannot be undone.
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
