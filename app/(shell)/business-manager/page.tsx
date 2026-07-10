"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import steampunkGirl from "@/assets/girl_steampunk.svg";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Hammer, Loader2, Upload } from "lucide-react";
import { BusinessTileCard } from "@/components/business-manager/BusinessTileCard";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { useShell } from "@/components/shell/ShellContext";
import type { BusinessExportPayload, BusinessSummary } from "@/lib/types";

const forgeArtUrl = typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;

export default function BusinessManagerPage() {
  const router = useRouter();
  const { switchBusiness, openNewBusiness, currentBusiness, refreshCurrentBusiness } = useShell();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [forgeArtSize, setForgeArtSize] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const forgeActionsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const actionsEl = forgeActionsRef.current;
    if (!actionsEl) return;

    const syncArtSize = () => {
      setForgeArtSize(actionsEl.getBoundingClientRect().height);
    };

    syncArtSize();
    const observer = new ResizeObserver(syncArtSize);
    observer.observe(actionsEl);
    return () => observer.disconnect();
  }, [loading, importing]);

  async function enterBusiness(id: string) {
    setSwitchingId(id);
    try {
      const switched = await switchBusiness(id);
      if (switched) router.push("/home");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleBusinessDeleted(deletedId: string) {
    const listRes = await fetch("/api/businesses");
    const listData = await listRes.json();
    const newList: BusinessSummary[] = listData.businesses || [];
    setBusinesses(newList);

    if (currentBusiness?.id === deletedId) {
      if (newList.length > 0) {
        await switchBusiness(newList[0].id);
        toast.info("Switched to another business");
      } else {
        await refreshCurrentBusiness();
      }
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("export.json");
      if (!jsonFile) {
        throw new Error("export.json not found in zip");
      }
      const jsonText = await jsonFile.async("string");
      const payload: BusinessExportPayload = JSON.parse(jsonText);

      const res = await fetch("/api/businesses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Import failed");
      }
      const created = await res.json();
      const businessId = created.business?.id;
      if (!businessId) {
        throw new Error("Import succeeded but no business was returned");
      }

      toast.success(`Imported business: ${created.business?.name || "New business"}`);
      await enterBusiness(businessId);
      await loadBusinesses();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to import business";
      toast.error(message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleImportFile(file);
  }

  return (
    <main className="business-manager">
      <div className="business-manager__inner">
        <header className="business-manager__header">
          <div className="business-manager__brand" aria-hidden>
            <HermesForgeMark className="hermes-forge-mark" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Hermes Forge</div>
            <h1 className="business-manager__title">Business Manager</h1>
            <p className="business-manager__subtitle">
              Choose a business to forge, or start fresh. This is your workspace hub before entering
              the studio.
            </p>
          </div>
        </header>

        <div className="business-manager__forge-panel">
          <div
            className="business-manager__forge-art-wrap"
            aria-hidden
            style={
              forgeArtSize
                ? ({ width: forgeArtSize, height: forgeArtSize } as CSSProperties)
                : undefined
            }
          >
            <div
              className="business-manager__forge-art"
              style={
                {
                  "--business-manager-forge-art-url": `url("${forgeArtUrl}")`,
                } as CSSProperties
              }
            />
          </div>

          <div ref={forgeActionsRef} className="business-manager__forge-actions">
          <button
            type="button"
            onClick={openNewBusiness}
            className="business-manager__forge-btn business-manager__forge-btn--primary"
          >
            <span className="business-manager__forge-btn-icon" aria-hidden>
              <Hammer className="w-6 h-6" />
            </span>
            <span className="business-manager__forge-btn-body">
              <span className="business-manager__forge-btn-label">Forge new business</span>
              <span className="business-manager__forge-btn-meta">Start with a blank workspace</span>
            </span>
          </button>

          <button
            type="button"
            onClick={triggerImport}
            disabled={importing}
            className="business-manager__forge-btn business-manager__forge-btn--import"
          >
            <span className="business-manager__forge-btn-icon" aria-hidden>
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </span>
            <span className="business-manager__forge-btn-body">
              <span className="business-manager__forge-btn-label">Forge existing business</span>
              <span className="business-manager__forge-btn-meta">Import a business export (ZIP)</span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            onChange={onFileChange}
          />
          </div>
        </div>

        <section className="business-manager__section" aria-labelledby="business-manager-your-businesses">
          <h2 id="business-manager-your-businesses" className="business-manager__section-title">
            Your businesses
          </h2>

          {loading ? (
            <div className="business-manager__status">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading businesses…</span>
            </div>
          ) : businesses.length === 0 ? (
            <div className="business-manager__empty">
              <Building2 className="w-10 h-10 text-text-soft mx-auto mb-3" />
              <p className="text-text-muted">No businesses yet. Forge a new one or import an existing export.</p>
            </div>
          ) : (
            <div className="business-manager__grid">
              {businesses.map((business) => (
                <BusinessTileCard
                  key={business.id}
                  business={business}
                  isSwitching={switchingId === business.id}
                  onEnter={() => void enterBusiness(business.id)}
                  onUpdate={(updated) =>
                    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
                  }
                  onDelete={() => void handleBusinessDeleted(business.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}