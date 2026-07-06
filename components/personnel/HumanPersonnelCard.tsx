"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, MoreVertical, Trash2, UserRound } from "lucide-react";

export interface HumanPersonnelItem {
  id: string;
  name: string;
  role: string;
  roleDescription: string | null;
  isOwner: boolean;
  createdAt: string;
}

interface HumanPersonnelCardProps {
  person: HumanPersonnelItem;
  onDelete: (id: string) => Promise<void>;
}

const MENU_WIDTH = 168;

export function HumanPersonnelCard({ person, onDelete }: HumanPersonnelCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [fireConfirm, setFireConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = useCallback(() => {
    menuTriggerRef.current = null;
    setMenuOpen(false);
    setMenuAnchor(null);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

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
  }, [closeMenu, menuOpen]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    menuTriggerRef.current = e.currentTarget;
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
    setMenuOpen(true);
  }

  function requestFire() {
    closeMenu();
    setFireConfirm(true);
  }

  async function confirmFire() {
    setDeleting(true);
    try {
      await onDelete(person.id);
      setFireConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove person");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <li
        className={`card p-5 ${person.isOwner ? "border-accent bg-accent-tint/40" : ""}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              person.isOwner ? "bg-accent-tint" : "bg-bg-muted"
            }`}
          >
            <UserRound className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-lg">{person.name}</div>
                  {person.isOwner && (
                    <span className="inline-flex items-center gap-1 pill pill-accent text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5">
                      <Crown className="w-3 h-3" />
                      Owner
                    </span>
                  )}
                </div>
                <div className="text-sm text-accent mt-0.5">{person.role}</div>
                {person.roleDescription && (
                  <p className="text-sm text-text-muted mt-2">{person.roleDescription}</p>
                )}
              </div>

              {!person.isOwner && (
                <div className="workflow-menu shrink-0">
                  <button
                    type="button"
                    onClick={toggleMenu}
                    className={`workflow-menu__trigger p-1.5 rounded-md hover:bg-bg-subtle text-text-muted hover:text-text ${
                      menuOpen ? "is-open" : ""
                    }`}
                    title="Person options"
                    aria-label={`Options for ${person.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </li>

      {menuOpen && menuAnchor && (
        <div
          ref={menuRef}
          className="workflow-menu__popover workflow-menu__popover--fixed"
          role="menu"
          aria-label={`Options for ${person.name}`}
          style={{ top: menuAnchor.top, left: menuAnchor.left, width: MENU_WIDTH }}
        >
          <button
            type="button"
            role="menuitem"
            className="workflow-menu__item workflow-menu__item--danger"
            onClick={(e) => {
              e.stopPropagation();
              requestFire();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove [FIRE]
          </button>
        </div>
      )}

      {fireConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close remove confirmation"
            onClick={() => !deleting && setFireConfirm(false)}
            disabled={deleting}
          />
          <div className="relative w-full max-w-md card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Remove from organization?</h2>
            <p className="text-sm text-text-muted mt-2">
              This will remove{" "}
              <span className="font-medium text-text">&quot;{person.name}&quot;</span>
              {person.role ? (
                <>
                  {" "}
                  (<span className="text-text-soft">{person.role}</span>)
                </>
              ) : null}{" "}
              from this business. [FIRE]
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setFireConfirm(false)}
                disabled={deleting}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmFire()}
                disabled={deleting}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove [FIRE]"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}