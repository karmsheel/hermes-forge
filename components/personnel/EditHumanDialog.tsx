"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

export interface EditHumanValues {
  name: string;
  role: string;
  roleDescription: string;
}

interface EditHumanDialogProps {
  open: boolean;
  personName: string;
  initial: EditHumanValues;
  /** Owner name is profile-synced and not editable here. */
  nameLocked?: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: EditHumanValues) => void;
}

function EditHumanForm({
  initial,
  nameLocked,
  saving,
  onClose,
  onSave,
}: {
  initial: EditHumanValues;
  nameLocked: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: EditHumanValues) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [roleDescription, setRoleDescription] = useState(initial.roleDescription);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole || saving) return;
    onSave({
      name: trimmedName,
      role: trimmedRole,
      roleDescription: roleDescription.trim(),
    });
  }

  const dirty =
    name.trim() !== initial.name.trim() ||
    role.trim() !== initial.role.trim() ||
    roleDescription.trim() !== initial.roleDescription.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="edit-human-name" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
          Name
        </label>
        <input
          id="edit-human-name"
          className="input w-full text-sm disabled:opacity-60"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Chen"
          autoFocus={!nameLocked}
          disabled={saving || nameLocked}
          required
        />
        {nameLocked && (
          <p className="text-xs text-text-soft mt-1.5">
            Owner name comes from your profile settings.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="edit-human-role" className="block text-xs uppercase tracking-widest text-text-muted mb-2">
          Role
        </label>
        <input
          id="edit-human-role"
          className="input w-full text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Operations Manager"
          autoFocus={nameLocked}
          disabled={saving}
          required
        />
      </div>

      <div>
        <label
          htmlFor="edit-human-role-description"
          className="block text-xs uppercase tracking-widest text-text-muted mb-2"
        >
          Role description <span className="normal-case tracking-normal text-text-soft">(optional)</span>
        </label>
        <textarea
          id="edit-human-role-description"
          className="input w-full text-sm min-h-[88px] resize-y"
          value={roleDescription}
          onChange={(e) => setRoleDescription(e.target.value)}
          placeholder="What does this person do on the team?"
          disabled={saving}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !role.trim() || !dirty}
          className="btn-primary text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save changes
        </button>
      </div>
    </form>
  );
}

export function EditHumanDialog({
  open,
  personName,
  initial,
  nameLocked = false,
  saving,
  onClose,
  onSave,
}: EditHumanDialogProps) {
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
        aria-label="Close edit person dialog"
        onClick={saving ? undefined : onClose}
        disabled={saving}
      />
      <div className="relative w-full max-w-md card p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6 pr-8">
          <h2 className="text-xl font-semibold tracking-tight">Edit person</h2>
          <p className="text-sm text-text-muted mt-1">
            Update details for{" "}
            <span className="font-medium text-text">&quot;{personName}&quot;</span>.
          </p>
        </div>

        <EditHumanForm
          key={`${initial.name}|${initial.role}|${initial.roleDescription}|${nameLocked}`}
          initial={initial}
          nameLocked={nameLocked}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
