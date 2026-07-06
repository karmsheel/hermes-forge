"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  Plus,
  Radar,
  UserRound,
  Users,
} from "lucide-react";
import { AddHumanDialog } from "@/components/personnel/AddHumanDialog";
import {
  HumanPersonnelCard,
  type HumanPersonnelItem,
} from "@/components/personnel/HumanPersonnelCard";
import { useShell } from "@/components/shell/ShellContext";

interface HermesAgentProfile {
  id: string;
  profileKey: string;
  displayName: string;
  description: string | null;
  model: string | null;
  hermesHome: string;
  isDefault: boolean;
  discoveredAt: string;
}

function PersonnelLists({ businessId }: { businessId: string | null }) {
  const router = useRouter();
  const [humans, setHumans] = useState<HumanPersonnelItem[]>([]);
  const [agents, setAgents] = useState<HermesAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addHumanOpen, setAddHumanOpen] = useState(false);
  const [humanFormKey, setHumanFormKey] = useState(0);
  const [creatingHuman, setCreatingHuman] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetch("/api/personnel/humans"), fetch("/api/personnel/agents")])
      .then(async ([humansRes, agentsRes]) => {
        if (cancelled) return;

        if (humansRes.status === 401 || agentsRes.status === 401) {
          router.push("/");
          return;
        }

        const humansData = await humansRes.json();
        const agentsData = await agentsRes.json();

        if (cancelled) return;

        setHumans(humansData.humans || []);
        setAgents(agentsData.agents || []);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load personnel");
        setHumans([]);
        setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, router]);

  const handleCreateHuman = useCallback(
    async (name: string, role: string, roleDescription: string) => {
      setCreatingHuman(true);
      try {
        const res = await fetch("/api/personnel/humans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            role,
            roleDescription: roleDescription || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to add person");
        }
        const human = await res.json();
        setHumans((prev) => [human, ...prev]);
        setAddHumanOpen(false);
        toast.success(`Added ${name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add person");
      } finally {
        setCreatingHuman(false);
      }
    },
    []
  );

  const handleDeleteHuman = useCallback(async (id: string) => {
    const res = await fetch(`/api/personnel/humans/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Failed to remove person");
    }
    setHumans((prev) => prev.filter((person) => person.id !== id));
    toast.success("Person removed from organization");
  }, []);

  const handleScanAgents = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await fetch("/api/personnel/agents", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Scan failed");
      }

      setAgents(data.agents || []);
      const { found = 0, added = 0, updated = 0 } = data.scan || {};
      if (found === 0) {
        toast.error("No Hermes profiles found on this machine");
      } else if (added > 0) {
        toast.success(`Found ${found} profile${found === 1 ? "" : "s"}, added ${added} new`);
      } else if (updated > 0) {
        toast.success(`Found ${found} profile${found === 1 ? "" : "s"}, refreshed ${updated}`);
      } else {
        toast.success(`Found ${found} Hermes profile${found === 1 ? "" : "s"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  if (loading) {
    return (
      <div className="text-center py-16 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Humans</h2>
                <p className="text-xs text-text-soft">People on your team</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setHumanFormKey((key) => key + 1);
                setAddHumanOpen(true);
              }}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              Add person
            </button>
          </div>

          {humans.length === 0 ? (
            <div className="card p-8 text-center border-dashed">
              <UserRound className="w-8 h-8 text-text-soft mx-auto mb-2" />
              <p className="text-sm text-text-muted">No people added yet.</p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {humans.map((person) => (
                <HumanPersonnelCard
                  key={person.id}
                  person={person}
                  onDelete={handleDeleteHuman}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Agents</h2>
                <p className="text-xs text-text-soft">Hermes profiles on this machine</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleScanAgents()}
              disabled={scanning}
              className="btn-secondary text-sm"
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radar className="w-4 h-4" />
              )}
              Scan for agents
            </button>
          </div>

          {agents.length === 0 ? (
            <div className="card p-8 text-center border-dashed">
              <Bot className="w-8 h-8 text-text-soft mx-auto mb-2" />
              <p className="text-sm text-text-muted mb-4">
                No Hermes agents linked yet. Scan to discover profiles from your Hermes installation.
              </p>
              <button
                type="button"
                onClick={() => void handleScanAgents()}
                disabled={scanning}
                className="btn-primary text-sm inline-flex"
              >
                {scanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Radar className="w-4 h-4" />
                )}
                Scan for agents
              </button>
            </div>
          ) : (
            <ul className="grid gap-3">
              {agents.map((agent) => (
                <li key={agent.id} className="card p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-lg">{agent.displayName}</div>
                        {agent.isDefault && (
                          <span className="text-[10px] uppercase tracking-widest text-text-soft border border-border rounded px-1.5 py-0.5">
                            Default
                          </span>
                        )}
                      </div>
                      {agent.model && (
                        <div className="text-xs text-text-soft mt-1 font-mono">{agent.model}</div>
                      )}
                      {agent.description && (
                        <p className="text-sm text-text-muted mt-2">{agent.description}</p>
                      )}
                      <p className="text-xs text-text-soft mt-2 truncate" title={agent.hermesHome}>
                        {agent.hermesHome}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AddHumanDialog
        open={addHumanOpen}
        formKey={humanFormKey}
        creating={creatingHuman}
        onClose={() => setAddHumanOpen(false)}
        onCreate={handleCreateHuman}
      />
    </>
  );
}

export default function PersonnelPage() {
  const { currentBusiness } = useShell();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Team</div>
        <h1 className="text-3xl font-semibold tracking-tight">Personnel</h1>
        {currentBusiness && <p className="text-sm text-accent mt-1">in {currentBusiness.name}</p>}
        <p className="text-sm text-text-muted mt-3 max-w-2xl">
          Humans and Hermes agents linked to this business. Scan your local Hermes installation to
          discover agent profiles.
        </p>
      </div>

      <PersonnelLists
        key={currentBusiness?.id ?? "no-business"}
        businessId={currentBusiness?.id ?? null}
      />
    </main>
  );
}