"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import type { BusinessIconKey } from "@/lib/business-avatar";
import { BusinessAvatarPickerFields } from "./BusinessAvatarPickerFields";

interface BusinessAvatarPickerProps {
  open: boolean;
  businessName: string;
  avatarEmoji: string | null;
  avatarIcon: string | null;
  saving: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectIcon: (iconKey: BusinessIconKey) => void;
  onClear: () => void;
}

export function BusinessAvatarPicker({
  open,
  businessName,
  avatarEmoji,
  avatarIcon,
  saving,
  onClose,
  onSelectEmoji,
  onSelectIcon,
  onClear,
}: BusinessAvatarPickerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close avatar picker"
        onClick={saving ? undefined : onClose}
        disabled={saving}
      />
      <div className="relative w-full max-w-md card p-6 business-avatar-picker">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-xl font-semibold tracking-tight">Business avatar</h2>
          <p className="text-sm text-text-muted mt-1">
            Choose an emoji or icon to represent <span className="text-text">{businessName}</span>.
          </p>
        </div>

        <BusinessAvatarPickerFields
          avatarEmoji={avatarEmoji}
          avatarIcon={avatarIcon}
          disabled={saving}
          onSelectEmoji={onSelectEmoji}
          onSelectIcon={onSelectIcon}
          onClear={onClear}
        />

        {saving && (
          <div className="flex justify-end mt-4">
            <span className="inline-flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}