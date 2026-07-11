"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, MoreVertical, Pencil, Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useShell } from "@/components/shell/ShellContext";
import { downloadBlob } from "@/lib/business-export";
import {
  businessInitial,
  resolveBusinessAvatar,
  resolveBusinessIcon,
  type BusinessIconKey,
} from "@/lib/business-avatar";
import { getProjectCardThumbStyle } from "@/lib/home/project-card-thumb";
import type { BusinessSummary } from "@/lib/types";
import { BusinessAvatarPicker } from "./BusinessAvatarPicker";

const MENU_WIDTH = 11.5 * 16;

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
  const { skin, resolved } = useTheme();
  const { currentBusiness, refreshCurrentBusiness } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(business.name);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [savingRename, setSavingRename] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const workflowCount = business._count?.processes ?? 0;
  const avatar = resolveBusinessAvatar(business.name, business.avatarEmoji, business.avatarIcon);
  const AvatarIcon = avatar.kind === "icon" ? resolveBusinessIcon(avatar.value) : null;

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

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, menuOpen]);

  function toggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAnchor({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
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
          <div
            className="business-manager__tile-thumb"
            style={avatar.kind === "initial" ? getProjectCardThumbStyle(business.name, skin, resolved) : undefined}
            aria-hidden
          >
            {avatar.kind === "emoji" ? (
              <span className="business-manager__tile-emoji">{avatar.value}</span>
            ) : avatar.kind === "icon" && AvatarIcon ? (
              <AvatarIcon className="business-manager__tile-icon" />
            ) : (
              <span className="business-manager__tile-initial">{businessInitial(business.name)}</span>
            )}
          </div>
          <div className="business-manager__tile-body">
            <span className="business-manager__tile-name">{business.name}</span>
            {business.description ? (
              <span className="business-manager__tile-meta">{business.description}</span>
            ) : (
              <span className="business-manager__tile-meta">
                {workflowCount === 1 ? "1 workflow" : `${workflowCount} workflows`}
              </span>
            )}
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
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {isSwitching && (
          <span className="business-manager__tile-loading" aria-hidden>
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
      </div>

      {menuOpen && menuAnchor && (
        <div
          ref={menuRef}
          className="workflow-menu__popover workflow-menu__popover--fixed"
          role="menu"
          aria-label={`Options for ${business.name}`}
          style={{ top: menuAnchor.top, left: menuAnchor.left, width: MENU_WIDTH }}
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
        </div>
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
            <p className="text-sm text-text-muted mt-2">Change the display name for this business.</p>
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