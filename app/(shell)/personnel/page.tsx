"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2, Plus, Radar, UserRound, Users } from "lucide-react";
import { AddHumanDialog } from "@/components/personnel/AddHumanDialog";
import {
  AvailableAgentCard,
  type AvailableAgentItem,
} from "@/components/personnel/AvailableAgentCard";
import {
  EditHumanDialog,
  type EditHumanValues,
} from "@/components/personnel/EditHumanDialog";
import { HireAgentDialog } from "@/components/personnel/HireAgentDialog";
import {
  PersonnelMemberCard,
  type AgentEmployeeItem,
  type EmployeeItem,
  type HumanEmployeeItem,
} from "@/components/personnel/PersonnelMemberCard";
import { useShell } from "@/components/shell/ShellContext";

function toHumanEmployee(human: {
  id: string;
  name: string;
  role: string;
  roleDescription: string | null;
  isOwner: boolean;
  iconKey?: string | null;
}): HumanEmployeeItem {
  return {
    kind: "human",
    id: human.id,
    name: human.name,
    role: human.role,
    roleDescription: human.roleDescription,
    isOwner: human.isOwner,
    iconKey: human.iconKey ?? null,
  };
}

function toAgentEmployee(agent: {
  id: string;
  displayName: string;
  description: string | null;
  model: string | null;
  profileKey: string;
  isDefault: boolean;
  isHired: boolean;
  iconKey?: string | null;
}): AgentEmployeeItem {
  return {
    kind: "agent",
    id: agent.id,
    displayName: agent.displayName,
    description: agent.description,
    model: agent.model,
    profileKey: agent.profileKey,
    isDefault: agent.isDefault,
    isHired: agent.isHired,
    iconKey: agent.iconKey ?? null,
  };
}

function PersonnelLists({
  businessId,
  businessName,
}: {
  businessId: string | null;
  businessName: string | null;
}) {
  const router = useRouter();
  const [humans, setHumans] = useState<HumanEmployeeItem[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AvailableAgentItem[]>([]);
  const [hiredAgents, setHiredAgents] = useState<AgentEmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addHumanOpen, setAddHumanOpen] = useState(false);
  const [humanFormKey, setHumanFormKey] = useState(0);
  const [creatingHuman, setCreatingHuman] = useState(false);
  const [editingHuman, setEditingHuman] = useState<HumanEmployeeItem | null>(null);
  const [savingHuman, setSavingHuman] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hiringAgent, setHiringAgent] = useState<AvailableAgentItem | null>(null);
  const [hiring, setHiring] = useState(false);

  const employees = useMemo<EmployeeItem[]>(
    () => [...humans, ...hiredAgents],
    [humans, hiredAgents]
  );

  const loadPersonnel = useCallback(async () => {
    const [humansRes, agentsRes] = await Promise.all([
      fetch("/api/personnel/humans"),
      fetch("/api/personnel/agents"),
    ]);

    if (humansRes.status === 401 || agentsRes.status === 401) {
      router.push("/");
      return;
    }

    const humansData = await humansRes.json();
    const agentsData = await agentsRes.json();

    setHumans((humansData.humans || []).map(toHumanEmployee));
    setAvailableAgents(
      (agentsData.available || agentsData.agents?.filter((a: { isHired: boolean }) => !a.isHired) || []).map(
        (agent: AvailableAgentItem) => ({
          ...agent,
          iconKey: agent.iconKey ?? null,
        })
      )
    );
    setHiredAgents(
      (agentsData.hired || agentsData.agents?.filter((a: { isHired: boolean }) => a.isHired) || []).map(
        toAgentEmployee
      )
    );
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    loadPersonnel()
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load personnel");
        setHumans([]);
        setAvailableAgents([]);
        setHiredAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, loadPersonnel]);

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
        setHumans((prev) => [toHumanEmployee(human), ...prev]);
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

  const handleFireHuman = useCallback(async (id: string) => {
    const res = await fetch(`/api/personnel/humans/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Failed to fire person");
    }
    setHumans((prev) => prev.filter((person) => person.id !== id));
    toast.success("Employee removed from organization");
  }, []);

  const handleSaveHuman = useCallback(
    async (values: EditHumanValues) => {
      if (!editingHuman) return;
      setSavingHuman(true);
      try {
        const body: Record<string, string | null> = {
          role: values.role,
          roleDescription: values.roleDescription || null,
        };
        if (!editingHuman.isOwner) {
          body.name = values.name;
        }

        const res = await fetch(`/api/personnel/humans/${editingHuman.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update person");
        }

        const updated = toHumanEmployee(data);
        setHumans((prev) =>
          prev.map((person) => (person.id === updated.id ? updated : person))
        );
        setEditingHuman(null);
        toast.success(`Updated ${updated.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update person");
      } finally {
        setSavingHuman(false);
      }
    },
    [editingHuman]
  );

  const handleFireAgent = useCallback(async (id: string) => {
    const res = await fetch(`/api/personnel/agents/${id}/fire`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Failed to fire agent");
    }
    const agent = toAgentEmployee(data);
    setHiredAgents((prev) => prev.filter((item) => item.id !== id));
    setAvailableAgents((prev) => [
      {
        id: agent.id,
        displayName: agent.displayName,
        description: agent.description,
        model: agent.model,
        profileKey: agent.profileKey,
        isDefault: agent.isDefault,
        iconKey: agent.iconKey,
      },
      ...prev,
    ]);
    toast.success("Agent fired from organization");
  }, []);

  const handleIconChange = useCallback(
    (id: string, kind: "human" | "agent", iconKey: string | null) => {
      if (kind === "human") {
        setHumans((prev) =>
          prev.map((person) => (person.id === id ? { ...person, iconKey } : person))
        );
      } else {
        setHiredAgents((prev) =>
          prev.map((agent) => (agent.id === id ? { ...agent, iconKey } : agent))
        );
        setAvailableAgents((prev) =>
          prev.map((agent) => (agent.id === id ? { ...agent, iconKey } : agent))
        );
      }
    },
    []
  );

  const handleScanAgents = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await fetch("/api/personnel/agents", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Scan failed");
      }

      setAvailableAgents(
        (data.available || []).map((agent: AvailableAgentItem) => ({
          ...agent,
          iconKey: agent.iconKey ?? null,
        }))
      );
      setHiredAgents((data.hired || []).map(toAgentEmployee));

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

  const handleConfirmHire = useCallback(async () => {
    if (!hiringAgent) return;
    setHiring(true);
    try {
      const res = await fetch(`/api/personnel/agents/${hiringAgent.id}/hire`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to hire agent");
      }

      const hired = toAgentEmployee(data);
      setAvailableAgents((prev) => prev.filter((agent) => agent.id !== hiringAgent.id));
      setHiredAgents((prev) => [hired, ...prev]);
      setHiringAgent(null);
      toast.success(`Hired ${hired.displayName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hire agent");
    } finally {
      setHiring(false);
    }
  }, [hiringAgent]);

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
                <h2 className="text-lg font-medium">Employees</h2>
                <p className="text-xs text-text-soft">Owner, team members, and hired agents</p>
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

          {employees.length === 0 ? (
            <div className="card p-8 text-center border-dashed">
              <UserRound className="w-8 h-8 text-text-soft mx-auto mb-2" />
              <p className="text-sm text-text-muted">No employees yet.</p>
            </div>
          ) : (
            <ul className="personnel-grid">
              {employees.map((employee) => (
                <PersonnelMemberCard
                  key={`${employee.kind}-${employee.id}`}
                  employee={employee}
                  onIconChange={handleIconChange}
                  onEditHuman={setEditingHuman}
                  onFireHuman={handleFireHuman}
                  onFireAgent={handleFireAgent}
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
                <h2 className="text-lg font-medium">Available agents</h2>
                <p className="text-xs text-text-soft">Hermes profiles discovered on this machine</p>
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

          {availableAgents.length === 0 ? (
            <div className="card p-8 text-center border-dashed">
              <Bot className="w-8 h-8 text-text-soft mx-auto mb-2" />
              <p className="text-sm text-text-muted mb-4">
                No Hermes agents discovered yet. Scan to find profiles from your Hermes installation.
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
            <ul className="personnel-grid">
              {availableAgents.map((agent) => (
                <AvailableAgentCard
                  key={agent.id}
                  agent={agent}
                  onIconChange={(id, iconKey) => handleIconChange(id, "agent", iconKey)}
                  onHire={setHiringAgent}
                />
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

      <EditHumanDialog
        open={editingHuman !== null}
        personName={editingHuman?.name ?? ""}
        initial={{
          name: editingHuman?.name ?? "",
          role: editingHuman?.role ?? "",
          roleDescription: editingHuman?.roleDescription ?? "",
        }}
        nameLocked={editingHuman?.isOwner ?? false}
        saving={savingHuman}
        onClose={() => !savingHuman && setEditingHuman(null)}
        onSave={(values) => void handleSaveHuman(values)}
      />

      <HireAgentDialog
        open={hiringAgent !== null}
        agentName={hiringAgent?.displayName ?? ""}
        businessName={businessName ?? "this business"}
        hiring={hiring}
        onClose={() => !hiring && setHiringAgent(null)}
        onConfirm={() => void handleConfirmHire()}
      />
    </>
  );
}

export default function PersonnelPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-text-muted max-w-2xl">
          Manage your org roster — humans and Hermes agents for this business. Scan your local
          Hermes installation to discover agent profiles. People and hired agents show up as{" "}
          <span className="text-text">@-mentions</span> in Workshop. Hired agents also appear in
          the chatbar picker for separate conversations.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => router.push("/personnel/hire")}
          >
            <Bot className="w-4 h-4" />
            Hire agents
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => router.push("/personnel/academy")}
          >
            Agent Academy
          </button>
        </div>
        <p className="text-xs text-text-soft mt-3 max-w-2xl rounded-lg border border-border bg-bg-subtle px-3 py-2">
          New businesses must hire a first agent before entering the studio. Train agents with
          skills and soul profiles in Agent Academy.
        </p>
      </div>

      <PersonnelLists
        key={currentBusiness?.id ?? "no-business"}
        businessId={currentBusiness?.id ?? null}
        businessName={currentBusiness?.name ?? null}
      />
    </>
  );
}