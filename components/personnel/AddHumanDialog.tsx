"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

interface AddHumanDialogProps {
  open: boolean;
  formKey: number;
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string, role: string, roleDescription: string) => void;
}

function AddHumanForm({
  creating,
  onClose,
  onCreate,
}: {
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string, role: string, roleDescription: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [roleDescription, setRoleDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole || creating) return;
    onCreate(trimmedName, trimmedRole, roleDescription.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="human-name" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
          Name
        </label>
        <input
          id="human-name"
          className="input w-full text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Chen"
          autoFocus
          disabled={creating}
          required
        />
      </div>

      <div>
        <label htmlFor="human-role" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
          Role
        </label>
        <input
          id="human-role"
          className="input w-full text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Operations Manager"
          disabled={creating}
          required
        />
      </div>

      <div>
        <label
          htmlFor="human-role-description"
          className="block text-xs uppercase tracking-widest text-text-muted mb-2"
        >
          Role description <span className="normal-case tracking-normal text-text-soft">(optional)</span>
        </label>
        <textarea
          id="human-role-description"
          className="input w-full text-sm min-h-[88px] resize-y"
          value={roleDescription}
          onChange={(e) => setRoleDescription(e.target.value)}
          placeholder="What does this person do on the team?"
          disabled={creating}
          rows={3}
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
          disabled={creating || !name.trim() || !role.trim()}
          className="btn-primary text-sm"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Add person
        </button>
      </div>
    </form>
  );
}

export function AddHumanDialog({ open, formKey, creating, onClose, onCreate }: AddHumanDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close add person dialog"
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
          <h2 className="text-xl font-semibold tracking-tight">Add person</h2>
          <p className="text-sm text-text-muted mt-1">
            Add a human team member to this business.
          </p>
        </div>

        <AddHumanForm key={formKey} creating={creating} onClose={onClose} onCreate={onCreate} />
      </div>
    </div>
  );
}