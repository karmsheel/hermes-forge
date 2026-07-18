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
  const [showSpawn, setShowSpawn] = useState(false);
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

  async function handleSpawn(e: React.FormEvent) {
    e.preventDefault();
    const displayName = spawnName.trim();
    if (!displayName || spawning) return;
    setSpawning(true);
    try {
      const res = await fetch("/api/overlord/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          description: spawnDescription.trim() || null,
          setAsOverlord: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to spawn profile");
      }
      const candidate = data.candidate as ScannedOverlordCandidate | undefined;
      if (!candidate?.profileKey) {
        throw new Error("Spawn succeeded but no profile was returned");
      }
      setCandidates((prev) => {
        if (prev.some((c) => c.profileKey === candidate.profileKey)) return prev;
        return [...prev, candidate];
      });
      setSelectedKey(candidate.profileKey);
      setShowSpawn(false);
      setSpawnName("");
      setSpawnDescription("");
      toast.success(`Created profile “${candidate.displayName}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not spawn profile");
    } finally {
      setSpawning(false);
    }
  }

  async function handleContinue() {
    if (!selectedKey || continuing) return;
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
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-soft text-accent mb-5">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.35em] text-accent mb-3">
          Forge Overlord
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isChange ? "Change your Forge Overlord" : "Choose your Forge Overlord"}
        </h1>
        <p className="text-sm text-text-muted mt-3 max-w-xl mx-auto leading-relaxed">
          This agent is your sole assistant for managing Forge-related business work.
          You will use it across businesses until you change it.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-widest text-text-muted">
          Hermes profiles on this machine
        </div>
        <button
          type="button"
          onClick={() => void loadCandidates({ rescan: true })}
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
      ) : candidates.length === 0 ? (
        <div className="card p-10 text-center border-dashed">
          <Bot className="w-10 h-10 text-text-soft mx-auto mb-3" />
          <h2 className="text-lg font-medium">No profiles found</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
            Install Hermes Agent locally and ensure profiles exist under your Hermes home
            directory, or spawn a new profile below.
          </p>
          <button
            type="button"
            onClick={() => void loadCandidates({ rescan: true })}
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
        </div>
      ) : (
        <ul className="personnel-grid">
          {candidates.map((candidate) => {
            const selected = selectedKey === candidate.profileKey;
            const subtitle =
              candidate.model ||
              (candidate.isDefault ? "Default profile" : "Hermes profile");
            return (
              <li
                key={candidate.profileKey}
                className="personnel-card"
                style={
                  selected
                    ? {
                        borderColor: "var(--selected)",
                        boxShadow: "0 0 0 2px var(--selected-soft)",
                      }
                    : undefined
                }
              >
                <button
                  type="button"
                  className="personnel-card__visual-btn"
                  style={{
                    aspectRatio: "4 / 3",
                    width: "100%",
                    background: selected
                      ? "var(--accent-tint)"
                      : "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-soft)",
                  }}
                  onClick={() => setSelectedKey(candidate.profileKey)}
                  aria-pressed={selected}
                >
                  <Bot
                    className="w-8 h-8"
                    style={{
                      color: selected ? "var(--accent)" : "var(--text-soft)",
                    }}
                  />
                </button>
                <div className="personnel-card__body">
                  <span className="personnel-card__name" title={candidate.displayName}>
                    {candidate.displayName}
                  </span>
                  <span className="personnel-card__meta" title={subtitle}>
                    {subtitle}
                  </span>
                  <button
                    type="button"
                    className="personnel-card__hire-btn"
                    onClick={() => setSelectedKey(candidate.profileKey)}
                  >
                    {selected ? "Selected" : "Select"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        {!showSpawn ? (
          <button
            type="button"
            className="btn-secondary text-sm inline-flex"
            onClick={() => setShowSpawn(true)}
          >
            <Plus className="w-4 h-4" />
            Spawn a new profile
          </button>
        ) : (
          <form
            onSubmit={(e) => void handleSpawn(e)}
            className="card p-6 space-y-4"
          >
            <div>
              <h2 className="text-base font-semibold">Spawn a new profile</h2>
              <p className="text-sm text-text-muted mt-1">
                Creates a Hermes profile directory on this machine, then selects it as
                your Overlord candidate.
              </p>
            </div>
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
                disabled={spawning}
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-text-muted">
                Description
              </span>
              <textarea
                className="input w-full mt-1.5 min-h-[4.5rem] resize-y"
                value={spawnDescription}
                onChange={(e) => setSpawnDescription(e.target.value)}
                placeholder="Optional notes for this profile"
                disabled={spawning}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={spawning || !spawnName.trim()}
              >
                {spawning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create profile
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={spawning}
                onClick={() => {
                  setShowSpawn(false);
                  setSpawnName("");
                  setSpawnDescription("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!selectedKey || continuing || loading}
          onClick={() => void handleContinue()}
        >
          {continuing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          Continue to Business Manager
        </button>
        {!selectedKey && !loading && (
          <p className="text-xs text-text-soft text-center">
            Select or spawn a profile to continue.
          </p>
        )}
      </div>
    </div>
  );
}
