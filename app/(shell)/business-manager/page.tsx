"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import steampunkGirl from "@/assets/girl_steampunk.svg";
import nousForgeArt from "@/assets/girl_nous.png";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, GitBranch, Hammer, Loader2, Upload } from "lucide-react";
import { BusinessTileCard } from "@/components/business-manager/BusinessTileCard";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { NavThemeModeToggle } from "@/components/shell/NavThemeModeToggle";
import { useShell } from "@/components/shell/ShellContext";
import { useShellNavigate } from "@/components/shell/useShellNavigate";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { BusinessExportPayload, BusinessSummary } from "@/lib/types";

const defaultForgeArtUrl = typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;

export default function BusinessManagerPage() {
  const router = useRouter();
  const { switchBusiness, openNewBusiness, currentBusiness, refreshCurrentBusiness } = useShell();
  const { openBusinessHome, enabled: tabsEnabled } = useShellNavigate();
  const { skinName } = useTheme();
  const useNousArt = skinName === "nous";
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingGit, setImportingGit] = useState(false);
  const [gitImportOpen, setGitImportOpen] = useState(false);
  const [gitImportMode, setGitImportMode] = useState<"path" | "remote">("remote");
  const [gitImportPath, setGitImportPath] = useState("");
  const [gitImportRemote, setGitImportRemote] = useState("");
  const [gitImportBranch, setGitImportBranch] = useState("main");
  const [forgeArtSize, setForgeArtSize] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const forgeActionsRef = useRef<HTMLDivElement>(null);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/businesses");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch {
      toast.error("Failed to load businesses");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    const actionsEl = forgeActionsRef.current;
    if (!actionsEl) return;

    const syncArtSize = () => {
      setForgeArtSize(actionsEl.getBoundingClientRect().height);
    };

    syncArtSize();
    const observer = new ResizeObserver(syncArtSize);
    observer.observe(actionsEl);
    return () => observer.disconnect();
  }, [loading, importing, importingGit, gitImportOpen]);

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
      const businessId = data.business?.id as string | undefined;
      if (businessId) {
        await enterBusiness(businessId, data.business?.name);
      } else {
        await loadBusinesses();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Git import failed");
    } finally {
      setImportingGit(false);
    }
  }

  async function enterBusiness(id: string, name?: string) {
    setSwitchingId(id);
    try {
      const picked = businesses.find((b) => b.id === id);
      const bizName = name ?? picked?.name ?? "Business";
      await openBusinessHome({
        businessId: id,
        businessName: bizName,
        avatarEmoji: picked?.avatarEmoji ?? null,
        avatarIcon: picked?.avatarIcon ?? null,
        switchAndEnter: switchBusiness,
      });
    } finally {
      setSwitchingId(null);
    }
  }

  async function openBusinessInNewTab(id: string, name: string) {
    const picked = businesses.find((b) => b.id === id);
    await openBusinessHome({
      businessId: id,
      businessName: name,
      avatarEmoji: picked?.avatarEmoji ?? null,
      avatarIcon: picked?.avatarIcon ?? null,
      newTab: true,
      switchAndEnter: switchBusiness,
    });
  }

  async function handleBusinessDeleted(deletedId: string) {
    const listRes = await fetch("/api/businesses");
    const listData = await listRes.json();
    const newList: BusinessSummary[] = listData.businesses || [];
    setBusinesses(newList);

    if (currentBusiness?.id === deletedId) {
      if (newList.length > 0) {
        await switchBusiness(newList[0].id);
        toast.info("Switched to another business");
      } else {
        await refreshCurrentBusiness();
      }
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
      const businessId = created.business?.id;
      if (!businessId) {
        throw new Error("Import succeeded but no business was returned");
      }

      toast.success(`Imported business: ${created.business?.name || "New business"}`);
      await enterBusiness(businessId);
      await loadBusinesses();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to import business";
      toast.error(message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleImportFile(file);
  }

  return (
    <main className="business-manager">
      <div className="business-manager__inner">
        <header className="business-manager__header">
          <div className="business-manager__brand" aria-hidden>
            <HermesForgeMark className="hermes-forge-mark" />
          </div>
          <div className="business-manager__header-text">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Hermes Forge</div>
            <h1 className="business-manager__title">Business Manager</h1>
            <p className="business-manager__subtitle">
              Choose a business to forge, import from ZIP or Git, and manage backup, export, and
              delete — your hub before entering the studio.
            </p>
          </div>
          <div className="business-manager__header-actions">
            <NavThemeModeToggle />
          </div>
        </header>

        <div className="business-manager__forge-panel">
          <div
            className="business-manager__forge-art-wrap"
            aria-hidden
            style={
              forgeArtSize
                ? ({ width: forgeArtSize, height: forgeArtSize } as CSSProperties)
                : undefined
            }
          >
            {useNousArt ? (
              <Image
                className="business-manager__forge-art business-manager__forge-art--raster"
                src={nousForgeArt}
                alt=""
                width={280}
                height={280}
              />
            ) : (
              <div
                className="business-manager__forge-art"
                style={
                  {
                    "--business-manager-forge-art-url": `url("${defaultForgeArtUrl}")`,
                  } as CSSProperties
                }
              />
            )}
          </div>

          <div ref={forgeActionsRef} className="business-manager__forge-actions">
          <button
            type="button"
            onClick={openNewBusiness}
            className="business-manager__forge-btn business-manager__forge-btn--primary"
          >
            <span className="business-manager__forge-btn-icon" aria-hidden>
              <Hammer className="w-6 h-6" />
            </span>
            <span className="business-manager__forge-btn-body">
              <span className="business-manager__forge-btn-label">Forge new business</span>
              <span className="business-manager__forge-btn-meta">Start with a blank workspace</span>
            </span>
          </button>

          <button
            type="button"
            onClick={triggerImport}
            disabled={importing || importingGit}
            className="business-manager__forge-btn business-manager__forge-btn--import"
          >
            <span className="business-manager__forge-btn-icon" aria-hidden>
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </span>
            <span className="business-manager__forge-btn-body">
              <span className="business-manager__forge-btn-label">Forge existing business</span>
              <span className="business-manager__forge-btn-meta">Import a business export (ZIP)</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setGitImportOpen((v) => !v)}
            disabled={importing || importingGit}
            className="business-manager__forge-btn business-manager__forge-btn--import"
          >
            <span className="business-manager__forge-btn-icon" aria-hidden>
              {importingGit ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <GitBranch className="w-5 h-5" />
              )}
            </span>
            <span className="business-manager__forge-btn-body">
              <span className="business-manager__forge-btn-label">Import from Git</span>
              <span className="business-manager__forge-btn-meta">
                Restore from a local path or remote repo
              </span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            onChange={onFileChange}
          />
          </div>
        </div>

        {gitImportOpen && (
          <form onSubmit={handleGitImport} className="card p-4 mb-6 space-y-3">
            <div className="text-sm font-medium">Restore business from Git</div>
            <p className="text-xs text-text-muted">
              Creates a <span className="text-text">new</span> business from a Hermes Forge repo
              snapshot (local path or remote clone). Uses system Git credentials for remotes.
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

        <section className="business-manager__section" aria-labelledby="business-manager-your-businesses">
          <h2 id="business-manager-your-businesses" className="business-manager__section-title">
            Your businesses
          </h2>
          <p className="text-sm text-text-muted mb-3">
            Open a business to enter the studio. Use the ⋮ menu for rename, avatar, ZIP export, Git
            sync / push, and delete.
          </p>

          {loading ? (
            <div className="business-manager__status">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading businesses…</span>
            </div>
          ) : businesses.length === 0 ? (
            <div className="business-manager__empty">
              <Building2 className="w-10 h-10 text-text-soft mx-auto mb-3" />
              <p className="text-text-muted">No businesses yet. Forge a new one or import an existing export.</p>
            </div>
          ) : (
            <div className="business-manager__grid">
              {businesses.map((business) => (
                <BusinessTileCard
                  key={business.id}
                  business={business}
                  isSwitching={switchingId === business.id}
                  onEnter={() => void enterBusiness(business.id, business.name)}
                  onOpenInNewTab={
                    tabsEnabled
                      ? () => void openBusinessInNewTab(business.id, business.name)
                      : undefined
                  }
                  onUpdate={(updated) =>
                    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
                  }
                  onDelete={() => void handleBusinessDeleted(business.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}