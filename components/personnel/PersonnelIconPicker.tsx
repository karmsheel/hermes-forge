"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PERSONNEL_ICON_KEYS,
  type PersonnelIconKey,
  resolvePersonnelIcon,
} from "@/lib/personnel/icon-catalog";

interface PersonnelIconPickerProps {
  kind: "human" | "agent";
  memberId: string;
  iconKey: string | null;
  isOwner?: boolean;
  onIconChange: (iconKey: string | null) => void;
}

export function PersonnelIconPicker({
  kind,
  memberId,
  iconKey,
  isOwner = false,
  onIconChange,
}: PersonnelIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      close();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  function togglePicker() {
    if (isOwner || saving) return;
    if (open) {
      close();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  }

  async function selectIcon(nextKey: PersonnelIconKey) {
    if (saving) return;
    setSaving(true);
    try {
      const endpoint =
        kind === "human"
          ? `/api/personnel/humans/${memberId}`
          : `/api/personnel/agents/${memberId}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconKey: nextKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update icon");
      }
      onIconChange(nextKey);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update icon");
    } finally {
      setSaving(false);
    }
  }

  const DisplayIcon = resolvePersonnelIcon(iconKey, kind, isOwner);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`personnel-card__visual-btn${isOwner ? " is-owner" : ""}`}
        onClick={togglePicker}
        disabled={isOwner || saving}
        title={isOwner ? "Owner icon" : "Change icon"}
        aria-label={isOwner ? "Owner icon" : "Change icon"}
      >
        {saving ? (
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        ) : (
          <DisplayIcon className="w-7 h-7 text-accent" />
        )}
      </button>

      {open && anchor && (
        <div
          ref={popoverRef}
          className="personnel-icon-picker"
          style={{ top: anchor.top, left: anchor.left }}
          role="dialog"
          aria-label="Choose icon"
        >
          {PERSONNEL_ICON_KEYS.map((key) => {
            const Icon = resolvePersonnelIcon(key, kind);
            const isActive = iconKey === key;
            return (
              <button
                key={key}
                type="button"
                className={`personnel-icon-picker__item${isActive ? " is-active" : ""}`}
                onClick={() => void selectIcon(key)}
                disabled={saving}
                aria-label={key}
                title={key}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}