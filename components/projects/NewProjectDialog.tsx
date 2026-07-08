"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { BusinessAvatarPickerFields } from "@/components/business-manager/BusinessAvatarPickerFields";
import type { BusinessIconKey } from "@/lib/business-avatar";
import type { NewBusinessInput } from "@/lib/new-business";

interface NewProjectDialogProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (input: NewBusinessInput) => void;
  title?: string;
  subtitle?: string;
}

export function NewProjectDialog({ open, creating, onClose, onCreate, title, subtitle }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [avatarIcon, setAvatarIcon] = useState<BusinessIconKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setAvatarEmoji(null);
    setAvatarIcon(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    onCreate({
      name: trimmedName,
      description: description.trim(),
      avatarEmoji,
      avatarIcon,
    });
  }

  function selectEmoji(emoji: string) {
    setAvatarEmoji(emoji);
    setAvatarIcon(null);
  }

  function selectIcon(iconKey: BusinessIconKey) {
    setAvatarIcon(iconKey);
    setAvatarEmoji(null);
  }

  function clearAvatar() {
    setAvatarEmoji(null);
    setAvatarIcon(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close new project dialog"
        onClick={creating ? undefined : onClose}
        disabled={creating}
      />
      <div className="relative w-full max-w-md card p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6 pr-8">
          <h2 className="text-xl font-semibold tracking-tight">{title || "New Business"}</h2>
          <p className="text-sm text-text-muted mt-1">
            {subtitle || "Name your business, add a description, and pick an avatar to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Name
            </label>
            <input
              id="project-name"
              className="input w-full text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Operations"
              autoFocus
              disabled={creating}
              required
            />
          </div>

          <div>
            <label htmlFor="project-description" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Description <span className="normal-case tracking-normal text-text-soft">(optional)</span>
            </label>
            <textarea
              id="project-description"
              className="input w-full text-sm min-h-[88px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this business about?"
              disabled={creating}
              rows={3}
            />
          </div>

          <div>
            <div className="block text-xs uppercase tracking-widest text-text-muted mb-2">
              Avatar <span className="normal-case tracking-normal text-text-soft">(optional)</span>
            </div>
            <BusinessAvatarPickerFields
              avatarEmoji={avatarEmoji}
              avatarIcon={avatarIcon}
              disabled={creating}
              onSelectEmoji={selectEmoji}
              onSelectIcon={selectIcon}
              onClear={clearAvatar}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="btn-primary text-sm"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Forge business
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}