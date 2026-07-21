"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CloudUpload,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  MoreVertical,
  Pencil,
  Settings2,
  Smile,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessGitStatus } from "@/lib/business-git";
import {
  buildBusinessExportPayload,
  createBusinessExportZip,
  downloadBlob,
  makeExportFilename,
} from "@/lib/business-export";
import {
  businessInitial,
  resolveBusinessAvatar,
  resolveBusinessIcon,
  type BusinessIconKey,
} from "@/lib/business-avatar";
import { timeAgo } from "@/lib/time-ago";
import type { BusinessSummary } from "@/lib/types";
import { BusinessAvatarPicker } from "./BusinessAvatarPicker";

const MENU_WIDTH = 13.5 * 16;
/** Approximate popover height (7–8 items + padding) for flip-above logic. */
const MENU_ESTIMATED_HEIGHT = 320;

interface BusinessTileCardProps {
  business: BusinessSummary;
  isSwitching: boolean;
  onEnter: () => void;
  /** Desktop multi-tab: open this business in a new shell tab (4.15). */
  onOpenInNewTab?: () => void;
  onUpdate: (updated: BusinessSummary) => void;
  onDelete: () => void;
}

export function BusinessTileCard({
  business,
  isSwitching,
  onEnter,
  onOpenInNewTab,
  onUpdate,
  onDelete,
}: BusinessTileCardProps) {
  const { currentBusiness, refreshCurrentBusiness } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(business.name);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [savingRename, setSavingRename] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [syncingGit, setSyncingGit] = useState(false);
  const [pushingGit, setPushingGit] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [gitStatus, setGitStatus] = useState<BusinessGitStatus | null>(null);
  const [remoteDraft, setRemoteDraft] = useState({ url: "", branch: "main" });
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const workflowCount = business._count?.processes ?? 0;
  const avatar = resolveBusinessAvatar(business.name, business.avatarEmoji, business.avatarIcon);
  const AvatarIcon = avatar.kind === "icon" ? resolveBusinessIcon(avatar.value) : null;
  const lastSaved = business.updatedAt ? timeAgo(business.updatedAt) : null;
  const lastSavedExact = business.updatedAt
    ? new Date(business.updatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : undefined;
  const gitBusy = syncingGit || pushingGit || savingRemote;
  const menuBusy = downloading || gitBusy || deleting;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuAnchor(null);
  }, []);

  useEffect(() => {
    setRenameValue(business.name);
  }, [business.name]);

  useEffect(() => {
    if (!menuOpen) return;

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuTriggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }

    // Defer so the opening click does not immediately dismiss the menu
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/businesses/${business.id}/git`);
        if (!res.ok || cancelled) return;
        const status = (await res.json()) as BusinessGitStatus;
        if (cancelled) return;
        setGitStatus(status);
        setRemoteDraft({
          url: status.remoteUrl ?? "",
          branch: status.remoteBranch ?? "main",
        });
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gap = 6;
    const edge = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right - MENU_WIDTH;
    if (left < edge) left = edge;
    if (left + MENU_WIDTH > vw - edge) left = Math.max(edge, vw - edge - MENU_WIDTH);

    const spaceBelow = vh - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    // Prefer opening above near the bottom of the viewport so all items stay visible
    const openAbove =
      spaceBelow < MENU_ESTIMATED_HEIGHT && spaceAbove > spaceBelow;

    if (openAbove) {
      setMenuAnchor({
        // Anchor to the trigger from below; height grows upward
        bottom: Math.max(edge, vh - rect.top + gap),
        left,
        maxHeight: Math.max(120, spaceAbove),
      });
    } else {
      setMenuAnchor({
        top: rect.bottom + gap,
        left,
        maxHeight: Math.max(120, spaceBelow),
      });
    }
    setMenuOpen(true);
  }

  async function patchBusiness(body: Record<string, unknown>) {
    const res = await fetch(`/api/businesses/${business.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Update failed");
    }
    onUpdate({ ...business, ...data });
    if (currentBusiness?.id === business.id) {
      await refreshCurrentBusiness();
    }
    return data;
  }

  async function refreshGitStatus() {
    const statusRes = await fetch(`/api/businesses/${business.id}/git`);
    if (!statusRes.ok) return;
    const status = (await statusRes.json()) as BusinessGitStatus;
    setGitStatus(status);
    setRemoteDraft((prev) => ({
      url: status.remoteUrl ?? prev.url,
      branch: status.remoteBranch ?? prev.branch ?? "main",
    }));
  }

  async function handleGitSync() {
    setSyncingGit(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Git sync failed");
      toast.success(data.committed ? `Synced to Git (${data.message})` : data.message);
      await refreshGitStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Git sync failed");
    } finally {
      setSyncingGit(false);
    }
  }

  async function handleGitPush(syncFirst: boolean) {
    setPushingGit(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: syncFirst ? "sync_and_push" : "push" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Git push failed");
      toast.success(data.message || "Pushed to remote");
      await refreshGitStatus();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Git push failed");
      await refreshGitStatus();
    } finally {
      setPushingGit(false);
    }
  }

  async function handleSaveRemote(e: React.FormEvent) {
    e.preventDefault();
    setSavingRemote(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}/git`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteUrl: remoteDraft.url.trim() || null,
          remoteBranch: remoteDraft.branch.trim() || "main",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save remote");
      toast.success(data.note || "Remote saved");
      await refreshGitStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save remote");
    } finally {
      setSavingRemote(false);
    }
  }

  async function handleDownloadZip() {
    setDownloading(true);
    try {
      const bizRes = await fetch(`/api/businesses/${business.id}`);
      if (!bizRes.ok) throw new Error("Failed to load business");
      const fullBiz = await bizRes.json();

      const procs = (fullBiz?.processes || []) as Array<{ id: string }>;
      const processesWithMessages = await Promise.all(
        procs.map(async (p) => {
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
            messages: (full.messages || []).map(
              (m: { role: string; content: string; createdAt: string }) => ({
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
              })
            ),
          };
        })
      );

      const validProcesses = processesWithMessages.filter(Boolean) as NonNullable<
        (typeof processesWithMessages)[number]
      >[];

      const payload = buildBusinessExportPayload({
        business: {
          name: fullBiz.name || business.name,
          description: fullBiz.description ?? business.description,
          industry: fullBiz.industry ?? business.industry,
        },
        processes: validProcesses,
        memories: fullBiz.memories,
      });

      const blob = await createBusinessExportZip(payload, business.name);
      const filename = makeExportFilename(business.name);
      await downloadBlob(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to export business as ZIP");
    } finally {
      setDownloading(false);
    }
  }

  async function confirmRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    if (trimmed === business.name) {
      setRenameOpen(false);
      return;
    }

    setSavingRename(true);
    try {
      await patchBusiness({ name: trimmed });
      setRenameOpen(false);
      toast.success("Business renamed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to rename business");
    } finally {
      setSavingRename(false);
    }
  }

  async function saveAvatar(body: { avatarEmoji: string | null; avatarIcon: string | null }) {
    setSavingAvatar(true);
    try {
      await patchBusiness(body);
      setAvatarOpen(false);
      toast.success("Business avatar updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const exportRes = await fetch(`/api/businesses/${business.id}/log/export`);
      if (!exportRes.ok) {
        const err = await exportRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to export business log archive");
      }
      const bundle = await exportRes.json();
      const archiveBlob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      downloadBlob(archiveBlob, `${business.name.replace(/[^\w.-]+/g, "_")}-business-log.json`);

      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportChecksum: bundle.checksum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }

      toast.success(`Deleted business: ${business.name}`);
      setDeleteOpen(false);
      onDelete();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete business");
    } finally {
      setDeleting(false);
    }
  }

  function openGitPanel() {
    setRemoteDraft({
      url: gitStatus?.remoteUrl ?? remoteDraft.url,
      branch: gitStatus?.remoteBranch ?? remoteDraft.branch ?? "main",
    });
    setGitOpen(true);
  }

  const gitMeta = gitStatus
    ? !gitStatus.gitAvailable
      ? "No Git"
      : !gitStatus.initialized
        ? "Untracked"
        : gitStatus.dirty
          ? "Git dirty"
          : gitStatus.remoteUrl
            ? gitStatus.lastPushedAt
              ? "Pushed"
              : "Remote set"
            : "Git local"
    : null;

  return (
    <>
      <div className={`business-manager__tile${isSwitching ? " is-loading" : ""}`}>
        <button
          type="button"
          onClick={(e) => {
            if (onOpenInNewTab && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onOpenInNewTab();
              return;
            }
            onEnter();
          }}
          disabled={isSwitching}
          className="business-manager__tile-main"
          title={
            onOpenInNewTab
              ? "Open business · Ctrl+click for new tab"
              : "Open business"
          }
        >
          <div className="business-manager__tile-thumb" aria-hidden>
            {avatar.kind === "emoji" ? (
              <span className="business-manager__tile-emoji">{avatar.value}</span>
            ) : avatar.kind === "icon" && AvatarIcon ? (
              <AvatarIcon className="business-manager__tile-icon" />
            ) : (
              <span className="business-manager__tile-initial">
                {businessInitial(business.name)}
              </span>
            )}
          </div>
          <div className="business-manager__tile-body">
            <span className="business-manager__tile-name">{business.name}</span>
            <span className="business-manager__tile-meta">
              {workflowCount === 1 ? "1 workflow" : `${workflowCount} workflows`}
              {gitMeta ? ` · ${gitMeta}` : ""}
            </span>
            {lastSaved ? (
              <span className="business-manager__tile-meta" title={lastSavedExact}>
                Saved {lastSaved}
              </span>
            ) : null}
          </div>
        </button>

        <div className="business-manager__tile-menu">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={toggleMenu}
            className={`business-manager__tile-menu-trigger workflow-menu__trigger${
              menuOpen ? " is-open" : ""
            }`}
            title="Business options"
            aria-label={`Options for ${business.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {menuBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MoreVertical className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {isSwitching && (
          <span className="business-manager__tile-loading" aria-hidden>
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
      </div>

      {menuOpen &&
        menuAnchor &&
        createPortal(
          <div
            ref={menuRef}
            className="workflow-menu__popover workflow-menu__popover--fixed"
            role="menu"
            aria-label={`Options for ${business.name}`}
            style={{
              top: menuAnchor.top ?? "auto",
              bottom: menuAnchor.bottom ?? "auto",
              left: menuAnchor.left,
              right: "auto",
              width: MENU_WIDTH,
              maxHeight: menuAnchor.maxHeight,
              overflowY: "auto",
            }}
          >
            {onOpenInNewTab ? (
              <button
                type="button"
                role="menuitem"
                className="workflow-menu__item"
                onClick={(e) => {
                  e.stopPropagation();
                  closeMenu();
                  onOpenInNewTab();
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                setRenameOpen(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                setAvatarOpen(true);
              }}
            >
              <Smile className="w-3.5 h-3.5" />
              Set emoji or icon
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              disabled={downloading}
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                void handleDownloadZip();
              }}
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download ZIP
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              disabled={gitBusy || gitStatus?.gitAvailable === false}
              title="Materialize and commit to local Git repo"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                void handleGitSync();
              }}
            >
              {syncingGit ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitBranch className="w-3.5 h-3.5" />
              )}
              Sync Git
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              disabled={
                gitBusy || gitStatus?.gitAvailable === false || !gitStatus?.remoteUrl
              }
              title={
                gitStatus?.remoteUrl
                  ? "Sync local repo then push to remote"
                  : "Configure a remote first"
              }
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                void handleGitPush(true);
              }}
            >
              {pushingGit ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              Push to remote
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                openGitPanel();
              }}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Git remote settings
            </button>
            <button
              type="button"
              role="menuitem"
              className="workflow-menu__item workflow-menu__item--danger"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}

      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close rename dialog"
            onClick={() => !savingRename && setRenameOpen(false)}
            disabled={savingRename}
          />
          <form onSubmit={confirmRename} className="relative w-full max-w-md card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Rename business</h2>
            <p className="text-sm text-text-muted mt-2">
              Change the display name for this business.
            </p>
            <input
              className="input w-full mt-4"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Business name"
              maxLength={120}
              autoFocus
              disabled={savingRename}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                disabled={savingRename}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRename || !renameValue.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {savingRename ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <BusinessAvatarPicker
        open={avatarOpen}
        businessName={business.name}
        avatarEmoji={business.avatarEmoji}
        avatarIcon={business.avatarIcon}
        saving={savingAvatar}
        onClose={() => !savingAvatar && setAvatarOpen(false)}
        onSelectEmoji={(emoji) => void saveAvatar({ avatarEmoji: emoji, avatarIcon: null })}
        onSelectIcon={(iconKey: BusinessIconKey) =>
          void saveAvatar({ avatarEmoji: null, avatarIcon: iconKey })
        }
        onClear={() => void saveAvatar({ avatarEmoji: null, avatarIcon: null })}
      />

      {gitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close Git settings"
            onClick={() => !gitBusy && setGitOpen(false)}
            disabled={gitBusy}
          />
          <form
            onSubmit={handleSaveRemote}
            className="relative w-full max-w-md card p-6 space-y-3"
          >
            <h2 className="text-xl font-semibold tracking-tight">Git remote</h2>
            <p className="text-sm text-text-muted">
              Local path:{" "}
              <span className="text-text-soft break-all">
                {gitStatus?.repoPath || "—"}
              </span>
            </p>
            {gitStatus?.lastPushError ? (
              <p className="text-xs text-red-400">{gitStatus.lastPushError}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
              <input
                className="input text-sm"
                placeholder="https://github.com/you/my-business.git"
                value={remoteDraft.url}
                onChange={(e) =>
                  setRemoteDraft((prev) => ({ ...prev, url: e.target.value }))
                }
                disabled={gitBusy}
              />
              <input
                className="input text-sm"
                placeholder="main"
                value={remoteDraft.branch}
                onChange={(e) =>
                  setRemoteDraft((prev) => ({ ...prev, branch: e.target.value }))
                }
                disabled={gitBusy}
              />
            </div>
            <p className="text-[11px] text-text-soft">
              Auth uses your system Git credentials (Credential Manager / SSH agent). Forge does not
              store tokens.
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={gitBusy}
                onClick={() => setGitOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={
                  gitBusy || !gitStatus?.remoteUrl || !gitStatus.initialized
                }
                onClick={() => void handleGitPush(false)}
                title="Push current HEAD without re-syncing"
              >
                {pushingGit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Push only"}
              </button>
              <button
                type="submit"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={gitBusy}
              >
                {savingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save remote"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close delete confirmation"
            onClick={() => !deleting && setDeleteOpen(false)}
            disabled={deleting}
          />
          <div className="relative w-full max-w-md card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Delete business?</h2>
            <p className="text-sm text-text-muted mt-2">
              This will permanently delete{" "}
              <span className="font-medium text-text">&ldquo;{business.name}&rdquo;</span> and all its
              workflows, diagrams, chats, and data. A business log archive will be downloaded first.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
