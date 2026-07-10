"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { BusinessAvatarMark } from "@/components/shell/BusinessAvatarMark";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessSummary } from "@/lib/types";

export function BusinessSwitcher() {
  const { currentBusiness, switchBusiness, openNewBusiness } = useShell();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentBusinessId = currentBusiness?.id ?? null;
  const displayName = currentBusiness?.name || "Select business";

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      minWidth: Math.max(rect.width, 280),
      maxWidth: 320,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => {
        setBusinesses(data.businesses || []);
      })
      .catch(() => {
        toast.error("Failed to load businesses");
        setBusinesses([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onLayoutChange() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, updateMenuPosition]);

  async function handleSelect(id: string) {
    if (id === currentBusinessId) {
      setOpen(false);
      return;
    }

    setSwitchingId(id);
    try {
      await switchBusiness(id);
      setOpen(false);
    } catch {
      toast.error("Could not switch business");
    } finally {
      setSwitchingId(null);
    }
  }

  const menu = open && mounted ? (
    <div
      ref={menuRef}
      className="business-switcher__menu"
      style={menuStyle}
      role="menu"
      aria-label="Switch business"
    >
      <div className="business-switcher__menu-header">
        <span className="business-switcher__menu-title">Your businesses</span>
      </div>

      {loading ? (
        <div className="business-switcher__status">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading businesses…</span>
        </div>
      ) : businesses.length === 0 ? (
        <div className="business-switcher__status business-switcher__status--muted">
          No businesses yet
        </div>
      ) : (
        <ul className="business-switcher__list">
          {businesses.map((b) => {
            const isActive = b.id === currentBusinessId;
            const isSwitching = switchingId === b.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => handleSelect(b.id)}
                  disabled={isSwitching}
                  className={`business-switcher__option${isActive ? " is-active" : ""}`}
                >
                  <BusinessAvatarMark
                    name={b.name}
                    avatarEmoji={b.avatarEmoji}
                    avatarIcon={b.avatarIcon}
                    className="business-switcher__option-avatar"
                  />
                  <span className="business-switcher__option-body">
                    <span className="business-switcher__option-name">{b.name}</span>
                    {b.description ? (
                      <span className="business-switcher__option-meta">{b.description}</span>
                    ) : (
                      <span className="business-switcher__option-meta">
                        {(b._count?.processes ?? 0) === 1
                          ? "1 workflow"
                          : `${b._count?.processes ?? 0} workflows`}
                      </span>
                    )}
                  </span>
                  {isSwitching ? (
                    <Loader2 className="business-switcher__option-indicator animate-spin" />
                  ) : isActive ? (
                    <Check className="business-switcher__option-indicator" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="business-switcher__menu-footer">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            openNewBusiness();
          }}
          className="business-switcher__create"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Create new business</span>
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="business-switcher" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`business-switcher__trigger${open ? " is-open" : ""}`}
        title="Switch business"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BusinessAvatarMark
          name={currentBusiness?.name ?? ""}
          avatarEmoji={currentBusiness?.avatarEmoji}
          avatarIcon={currentBusiness?.avatarIcon}
        />
        <span className="business-switcher__label">{displayName}</span>
        <span className="business-switcher__chevron" aria-hidden>
          <ChevronDown className={`business-switcher__chevron-icon${open ? " is-open" : ""}`} />
        </span>
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}