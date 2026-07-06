"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessSummary } from "@/lib/types";

function businessInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export default function BusinessManagerPage() {
  const router = useRouter();
  const { currentBusiness, switchBusiness, openNewProject } = useShell();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/businesses");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch {
      toast.error("Failed to load businesses");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  async function handleSelect(id: string) {
    if (id === currentBusiness?.id) {
      router.push("/workshop");
      return;
    }

    setSwitchingId(id);
    try {
      const switched = await switchBusiness(id);
      if (switched) router.push("/workshop");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <main className="business-manager max-w-3xl mx-auto px-6 py-10 w-full">
      <div className="business-manager__header">
        <div className="business-manager__brand" aria-hidden>
          <HermesForgeMark className="hermes-forge-mark" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight">Business Manager</h1>
          <p className="text-sm text-text-muted mt-2 max-w-xl">
            Create a new business or switch to one you already have. Your selection drives workflows,
            personnel, and the business log across the app.
          </p>
        </div>
      </div>

      <div className="business-manager__actions">
        <button type="button" onClick={openNewProject} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Create new business
        </button>
        {currentBusiness && (
          <p className="text-sm text-text-muted">
            Active: <span className="text-accent font-medium">{currentBusiness.name}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="business-manager__status">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading businesses…</span>
        </div>
      ) : businesses.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <Building2 className="w-10 h-10 text-text-soft mx-auto mb-3" />
          <p className="text-text-muted mb-4">No businesses yet. Create your first one to get started.</p>
          <button type="button" onClick={openNewProject} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Create new business
          </button>
        </div>
      ) : (
        <ul className="business-manager__list">
          {businesses.map((business) => {
            const isActive = business.id === currentBusiness?.id;
            const isSwitching = switchingId === business.id;
            const workflowCount = business._count?.processes ?? 0;

            return (
              <li key={business.id}>
                <button
                  type="button"
                  onClick={() => void handleSelect(business.id)}
                  disabled={isSwitching}
                  className={`business-manager__card${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="business-manager__card-avatar" aria-hidden>
                    {businessInitial(business.name)}
                  </span>
                  <span className="business-manager__card-body">
                    <span className="business-manager__card-name">{business.name}</span>
                    {business.description ? (
                      <span className="business-manager__card-meta">{business.description}</span>
                    ) : (
                      <span className="business-manager__card-meta">
                        {workflowCount === 1 ? "1 workflow" : `${workflowCount} workflows`}
                      </span>
                    )}
                  </span>
                  {isSwitching ? (
                    <Loader2 className="business-manager__card-indicator animate-spin" />
                  ) : isActive ? (
                    <Check className="business-manager__card-indicator" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}