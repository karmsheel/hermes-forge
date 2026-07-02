"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Loader2, Plus, X } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessSummary } from "@/lib/types";

interface BusinessSwitcherDialogProps {
  open: boolean;
  onClose: () => void;
  currentBusinessId?: string | null;
  onSwitchRequested?: (id: string) => void;
}

export function BusinessSwitcherDialog({
  open,
  onClose,
  currentBusinessId,
  onSwitchRequested,
}: BusinessSwitcherDialogProps) {
  const { openNewProject, switchBusiness: shellSwitchBusiness } = useShell();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

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
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSelect(id: string) {
    if (id === currentBusinessId) {
      onClose();
      return;
    }
    setSwitchingId(id);
    try {
      if (shellSwitchBusiness) {
        await shellSwitchBusiness(id);
      } else {
        // Fallback direct
        const res = await fetch("/api/businesses/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: id }),
        });
        if (!res.ok) throw new Error("Failed to switch");
        onSwitchRequested?.(id);
        router.refresh();
      }
      onClose();
    } catch {
      toast.error("Could not switch business");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close business switcher"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md card p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4 pr-8">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold tracking-tight">Your Businesses</h2>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Switch the active business or create a new one. Functions (e.g. Marketing, Revenue) are auto-categorized within each business.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading businesses...
          </div>
        ) : businesses.length === 0 ? (
          <div className="card p-6 border-dashed text-center mb-4">
            <p className="text-sm text-text-muted">No businesses yet.</p>
          </div>
        ) : (
          <ul className="max-h-[320px] overflow-auto -mx-1 mb-4 space-y-1 pr-1">
            {businesses.map((b) => {
              const isActive = b.id === currentBusinessId;
              const isSwitching = switchingId === b.id;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    disabled={isSwitching}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      isActive
                        ? "border-green-border bg-bg-subtle"
                        : "border-border hover:bg-bg-subtle"
                    } disabled:opacity-60`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-2">
                        {b.name}
                        {isActive && <Check className="w-4 h-4 text-green shrink-0" />}
                      </div>
                      {b.description && (
                        <div className="text-xs text-text-muted line-clamp-1 mt-0.5">{b.description}</div>
                      )}
                      <div className="text-[10px] text-text-soft mt-1">
                        {b._count?.processes ?? 0} workflow{(b._count?.processes ?? 0) !== 1 ? "s" : ""}
                      </div>
                    </div>
                    {isSwitching && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            openNewProject();
          }}
          className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Create new business
        </button>
        <p className="text-[10px] text-center text-text-soft mt-2">
          Opens the name + description dialog.
        </p>
      </div>
    </div>
  );
}
