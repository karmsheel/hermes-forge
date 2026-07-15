"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2, Radar, Sparkles } from "lucide-react";
import {
  AvailableAgentCard,
  type AvailableAgentItem,
} from "@/components/personnel/AvailableAgentCard";
import { useShell } from "@/components/shell/ShellContext";
import { saveActiveChatbarAgentId } from "@/lib/chatbar/active-agent";

function AgentHireInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "1";
  const { currentBusiness } = useShell();
  const businessId = currentBusiness?.id ?? null;
  const businessName = currentBusiness?.name ?? "your business";

  const [available, setAvailable] = useState<AvailableAgentItem[]>([]);
  const [hiredCount, setHiredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [hiringId, setHiringId] = useState<string | null>(null);

  const applyAgentPayload = useCallback((data: {
    available?: AvailableAgentItem[];
    hired?: { id: string }[];
  }) => {
    setAvailable(
      (data.available || []).map((agent) => ({
        ...agent,
        iconKey: agent.iconKey ?? null,
      })),
    );
    setHiredCount((data.hired || []).length);
  }, []);

  const loadAndScan = useCallback(
    async (autoScan: boolean) => {
      setLoading(true);
      try {
        if (autoScan) {
          setScanning(true);
          const scanRes = await fetch("/api/personnel/agents", { method: "POST" });
          const scanData = await scanRes.json().catch(() => ({}));
          if (scanRes.ok) {
            applyAgentPayload(scanData);
            return;
          }
          // Fall through to GET if scan fails (e.g. no Hermes home yet)
        }

        const res = await fetch("/api/personnel/agents");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json();
        applyAgentPayload(data);
      } catch {
        toast.error("Could not load Hermes agents");
      } finally {
        setScanning(false);
        setLoading(false);
      }
    },
    [applyAgentPayload, router],
  );

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    void loadAndScan(true);
  }, [businessId, loadAndScan]);

  // If hire is not required and they already have agents, roster is fine
  useEffect(() => {
    if (required || loading) return;
    if (hiredCount > 0 && available.length === 0) {
      // optional: stay to hire more
    }
  }, [required, loading, hiredCount, available.length]);

  // Required mode: if they somehow already have a hire, leave
  useEffect(() => {
    if (!required || loading) return;
    if (hiredCount > 0) {
      router.replace("/foundation");
    }
  }, [required, loading, hiredCount, router]);

  async function handleHire(agent: AvailableAgentItem) {
    if (hiringId) return;
    setHiringId(agent.id);
    try {
      const res = await fetch(`/api/personnel/agents/${agent.id}/hire`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to hire agent");
      }

      if (businessId) {
        saveActiveChatbarAgentId(businessId, data.id || agent.id);
      }

      toast.success(`Hired ${data.displayName || agent.displayName}`, {
        description: "They are now your chatbar agent for this business.",
      });

      router.push("/foundation");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hire agent");
      setHiringId(null);
    }
  }

  if (!businessId) {
    return (
      <div className="app-shell flex items-center justify-center px-6 py-16">
        <div className="card max-w-md p-8 text-center">
          <Bot className="w-8 h-8 text-text-soft mx-auto mb-3" />
          <h1 className="text-xl font-semibold">Select a business first</h1>
          <p className="text-sm text-text-muted mt-2">
            Hire agents into a business from Business Manager.
          </p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => router.push("/business-manager")}
          >
            Business Manager
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-soft text-accent mb-5">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.35em] text-accent mb-3">
          Agent hire
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {required ? "Hire your first agent" : "Hire an agent"}
        </h1>
        <p className="text-sm text-text-muted mt-3 max-w-xl mx-auto leading-relaxed">
          {required ? (
            <>
              <span className="text-text font-medium">{businessName}</span> needs a Hermes
              agent before you can use the studio. The agent you hire becomes the voice in
              the chatbar — you can hire more later under Personnel and switch between them.
            </>
          ) : (
            <>
              Bring a Hermes profile into{" "}
              <span className="text-text font-medium">{businessName}</span>. Hired agents
              appear in the chatbar picker for separate conversations.
            </>
          )}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-widest text-text-muted">
          Available on this machine
        </div>
        <button
          type="button"
          onClick={() => void loadAndScan(true)}
          disabled={scanning || loading}
          className="btn-secondary text-sm"
        >
          {scanning || loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Radar className="w-4 h-4" />
          )}
          Rescan
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          Scanning Hermes profiles…
        </div>
      ) : available.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <Bot className="w-10 h-10 text-text-soft mx-auto mb-3" />
          <h2 className="text-lg font-medium">No agents found</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
            Install Hermes Agent locally and ensure profiles exist under your Hermes home
            directory, then rescan.
          </p>
          <button
            type="button"
            onClick={() => void loadAndScan(true)}
            disabled={scanning}
            className="btn-primary mt-6 inline-flex"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Radar className="w-4 h-4" />
            )}
            Scan again
          </button>
          {!required && (
            <button
              type="button"
              className="btn-secondary mt-3 block mx-auto text-sm"
              onClick={() => router.push("/personnel")}
            >
              Back to roster
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="personnel-grid">
            {available.map((agent) => (
              <AvailableAgentCard
                key={agent.id}
                agent={agent}
                onIconChange={() => {
                  /* icons optional on first hire */
                }}
                onHire={(a) => {
                  if (!hiringId) void handleHire(a);
                }}
              />
            ))}
          </ul>
          {hiringId && (
            <div className="mt-4 text-center text-sm text-text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Hiring agent…
            </div>
          )}
          {!required && (
            <div className="mt-8 text-center">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => router.push("/personnel")}
              >
                Back to roster
              </button>
            </div>
          )}
          {required && (
            <p className="text-xs text-text-soft text-center mt-8">
              You must hire at least one agent to continue into the studio for this business.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function AgentHirePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <AgentHireInner />
    </Suspense>
  );
}
