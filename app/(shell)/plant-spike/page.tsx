"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessGraphCanvas } from "@/components/plant/spike/BusinessGraphCanvas";
import type { BusinessGraph } from "@/lib/business-graph";

/**
 * Graph MVP spike: local Business.graphJson on xyflow.
 * Foundation view (units/capabilities) + process step view.
 * See docs/references/PRODUCT_VISION.md
 */
export default function PlantSpikePage() {
  const router = useRouter();
  const [graph, setGraph] = useState<BusinessGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { reseed?: boolean }) => {
      setLoading(true);
      try {
        const q = opts?.reseed ? "?reseed=1" : "";
        const res = await fetch(`/api/business-graph${q}`);
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load graph");
          setGraph(null);
          return;
        }
        setGraph(data.graph);
        setBusinessName(data.business?.name ?? null);
        if (data.seeded && opts?.reseed) {
          toast.success("Graph reseeded from functions & processes");
        } else if (data.seeded) {
          toast.message("Graph seeded from existing business data");
        }
      } catch {
        toast.error("Failed to load business graph");
        setGraph(null);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onPositionCommit = useCallback(
    async (id: string, x: number, y: number) => {
      try {
        const res = await fetch("/api/business-graph", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ops: [{ op: "set_position", id, position: { x, y } }],
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.graph) setGraph(data.graph);
      } catch {
        /* ignore drag save errors */
      }
    },
    [],
  );

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-text overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-2 bg-bg-panel">
        <p className="text-xs text-text-muted">
          <span className="text-amber font-medium">Dev tool</span>
          {" · "}
          <span className="text-text-faint">
            Product path is Foundation + Map (8.3/8.4). This spike is not in the room switcher.
          </span>
          {businessName ? ` · ${businessName}` : ""}
          {" · "}
          local graphJson ·{" "}
          <code className="text-[11px]">PRODUCT_VISION.md</code>
        </p>
      </header>
      <BusinessGraphCanvas
        graph={graph}
        loading={loading}
        onRefresh={() => void load()}
        onReseed={() => void load({ reseed: true })}
        onPositionCommit={onPositionCommit}
      />
    </div>
  );
}
