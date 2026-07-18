"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2, Plus, Radar, Sparkles } from "lucide-react";
import type {
  ForgeOverlordSummary,
  ScannedOverlordCandidate,
} from "@/lib/overlord/types";

export function OverlordSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChange = searchParams.get("change") === "1";

  const [candidates, setCandidates] = useState<ScannedOverlordCandidate[]>([]);
  const [serverOverlord, setServerOverlord] = useState<ForgeOverlordSummary | null>(
    null,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [spawnName, setSpawnName] = useState("");
  const [spawnDescription, setSpawnDescription] = useState("");
  const [spawning, setSpawning] = useState(false);

  const loadCandidates = useCallback(async (opts?: { rescan?: boolean }) => {
    if (opts?.rescan) setScanning(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/overlord");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load Overlord candidates");
      }
      const data = (await res.json()) as {
        overlord: ForgeOverlordSummary | null;
        candidates: ScannedOverlordCandidate[];
      };
      setCandidates(data.candidates || []);
      setServerOverlord(data.overlord ?? null);
      setSelectedKey((prev) => {
        if (prev && (data.candidates || []).some((c) => c.profileKey === prev)) {
          return prev;
        }
        return data.overlord?.profileKey ?? null;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Hermes profiles");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const displayName = spawnName.trim();
    if (!displayName || spawning || continuing) return;
    setSpawning(true);
    try {
      const res = await fetch("/api/overlord/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          description: spawnDescription.trim() || null,
          setAsOverlord: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Overlord profile");
      }
      toast.success("Forge Overlord created");
      router.push("/business-manager");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create profile");
      setSpawning(false);
    }
  }

  async function handleContinueWithExisting() {
    if (!selectedKey || continuing || spawning) return;
    setContinuing(true);
    try {
      if (selectedKey !== serverOverlord?.profileKey) {
        const selected = candidates.find((c) => c.profileKey === selectedKey);
        const res = await fetch("/api/overlord", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileKey: selectedKey,
            ...(selected?.displayName
              ? { displayName: selected.displayName }
              : {}),
            ...(selected?.hermesHome ? { hermesHome: selected.hermesHome } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to set Forge Overlord");
        }
        toast.success("Forge Overlord set");
      } else {
        toast.success("Continuing…");
      }
      router.push("/business-manager");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue");
      setContinuing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 w-full">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-soft text-accent mb-5">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.35em] text-accent mb-3">
          Welcome to Hermes Forge
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isChange ? "Change your Forge Overlord" : "Meet your Forge Overlord"}
        </h1>
        <p className="text-sm text-text-muted mt-3 max-w-xl mx-auto leading-relaxed">
          Hermes Forge is agent-assisted software. Your Overlord is the sole assistant
          that manages Forge work — skills, many conversations, and your businesses —
          until you change it.
        </p>
      </div>

      {/* Option 1 — recommended: create a dedicated agent */}
      <section
        className="card p-6 mb-6 space-y-4"
        style={{
          borderColor: "var(--selected)",
          boxShadow: "0 0 0 2px var(--selected-soft)",
        }}
        aria-labelledby="overlord-create-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.25em] text-accent mb-2">
              Recommended
            </p>
            <h2 id="overlord-create-heading" className="text-lg font-semibold">
              Create a separate agent to handle the Forge
            </h2>
            <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
              Spawns a dedicated Hermes profile on this machine for Forge skills and
              many conversations — kept separate from your day-to-day agents.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider">
            <Plus className="w-3 h-3" />
            New
          </span>
        </div>

        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-text-muted">
              Name <span className="text-accent">*</span>
            </span>
            <input
              type="text"
              className="input w-full mt-1.5"
              value={spawnName}
              onChange={(e) => setSpawnName(e.target.value)}
              placeholder="e.g. Forge Overlord"
              required
              autoFocus
              disabled={spawning || continuing}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-text-muted">
              Description
            </span>
            <textarea
              className="input w-full mt-1.5 min-h-[4rem] resize-y"
              value={spawnDescription}
              onChange={(e) => setSpawnDescription(e.target.value)}
              placeholder="Optional notes for this profile"
              disabled={spawning || continuing}
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={spawning || continuing || !spawnName.trim()}
          >
            {spawning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Overlord &amp; continue
          </button>
        </form>
      </section>

      {/* Option 2 — use existing Hermes profile */}
      <section className="card p-6 space-y-4" aria-labelledby="overlord-existing-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.25em] text-text-muted mb-2">
              Alternative
            </p>
            <h2 id="overlord-existing-heading" className="text-lg font-semibold">
              Use an existing agent
            </h2>
            <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
              Pick a Hermes profile already on this machine as your Forge Overlord.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadCandidates({ rescan: true })}
            disabled={scanning || loading || spawning || continuing}
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
          <div className="py-8 text-center text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Scanning Hermes profiles…
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-border-soft rounded-xl">
            <Bot className="w-8 h-8 text-text-soft mx-auto mb-2" />
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              No profiles found. Create a dedicated Overlord above, or install Hermes
              Agent and rescan.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {candidates.map((candidate) => {
              const selected = selectedKey === candidate.profileKey;
              const subtitle =
                candidate.model ||
                (candidate.isDefault ? "Default profile" : "Hermes profile");
              return (
                <li key={candidate.profileKey}>
                  <button
                    type="button"
                    className="w-full text-left rounded-xl border px-4 py-3 transition-colors"
                    style={
                      selected
                        ? {
                            borderColor: "var(--selected)",
                            boxShadow: "0 0 0 2px var(--selected-soft)",
                            background: "var(--accent-tint)",
                          }
                        : {
                            borderColor: "var(--border)",
                            background: "var(--bg-muted)",
                          }
                    }
                    onClick={() => setSelectedKey(candidate.profileKey)}
                    aria-pressed={selected}
                    disabled={spawning || continuing}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Bot
                        className="w-5 h-5 shrink-0"
                        style={{
                          color: selected ? "var(--accent)" : "var(--text-soft)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {candidate.displayName}
                        </div>
                        <div className="text-xs text-text-muted truncate">{subtitle}</div>
                      </div>
                      <span className="text-xs font-medium shrink-0 text-text-muted">
                        {selected ? "Selected" : "Select"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col items-stretch sm:items-start gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary"
            disabled={!selectedKey || continuing || loading || spawning}
            onClick={() => void handleContinueWithExisting()}
          >
            {continuing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Continue with selected agent
          </button>
          {!selectedKey && !loading && candidates.length > 0 && (
            <p className="text-xs text-text-soft">
              Select a profile above to continue with an existing agent.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
