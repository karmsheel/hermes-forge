"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { CredentialChecklist } from "./CredentialChecklist";
import { RunHealthCard } from "./RunHealthCard";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useN8nConnection } from "@/components/n8n/N8nConnectionProvider";
import { hermesApiBody } from "@/lib/hermes-models";
import type {
  AutomationAgentSummary,
  AutomationPlan,
  AutomationStudioData,
  CredentialMap,
  IntegrationRequirement,
} from "@/lib/automation-types";
import type { AutomationDeployStatus } from "@/lib/process-status";
import type { AutomationRunHealthSummary } from "@/lib/types";
import Link from "next/link";

type DeployType = "hermes_cron" | "n8n_workflow";

interface DeployPanelProps {
  processId: string;
  plan: AutomationPlan | null;
  integrations: IntegrationRequirement[];
  credentialMap: CredentialMap;
  automation: AutomationStudioData["automation"];
  hiredAgents: AutomationAgentSummary[];
  assignedAgent: AutomationAgentSummary | null;
  deployStatus: AutomationDeployStatus;
  onCredentialMapChange: (map: CredentialMap) => void;
  onAgentChange: (agentId: string | null) => void | Promise<void>;
  onDeployed: (studio: AutomationStudioData) => void;
  onOpenN8nConnection: () => void;
}

const DELIVER_OPTIONS = [
  { value: "local", label: "Local file" },
  { value: "telegram", label: "Telegram" },
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "email", label: "Email" },
];

export function DeployPanel({
  processId,
  plan,
  integrations,
  credentialMap,
  automation,
  hiredAgents,
  assignedAgent,
  deployStatus,
  onCredentialMapChange,
  onAgentChange,
  onDeployed,
  onOpenN8nConnection,
}: DeployPanelProps) {
  const { config: hermesConfig, isConnected: hermesConnected } = useHermesConnection();
  const { config: n8nConfig, isConnected: n8nConnected } = useN8nConnection();

  // M0: Hermes cron is the primary path; n8n remains available as advanced.
  const [deployType, setDeployType] = useState<DeployType>("hermes_cron");
  const [schedule, setSchedule] = useState(plan?.schedule ?? "every 1d at 09:00");
  const [deliver, setDeliver] = useState(plan?.deliveryChannel ?? "local");
  const [deploying, setDeploying] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simTitle, setSimTitle] = useState("");
  const [simBody, setSimBody] = useState("");
  const [health, setHealth] = useState<AutomationRunHealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [controlling, setControlling] = useState(false);

  const alreadyDeployed = Boolean(automation.externalId);
  const isHermesCron =
    alreadyDeployed && (automation.type === "hermes_cron" || !automation.type);
  const isPaused = automation.status === "paused";
  const canDeploy = Boolean(plan?.summary) && !alreadyDeployed && !deploying;
  const selectedAgentId = assignedAgent?.id ?? automation.hermesAgentProfileId ?? "";
  const needsAgentForCron = deployType === "hermes_cron" && !selectedAgentId;

  const refreshHealth = useCallback(async () => {
    if (!hermesConfig || !isHermesCron) return;
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/processes/${processId}/automation/health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hermesApiBody(hermesConfig)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Health refresh failed");
      if (data.health) setHealth(data.health);
      if (data.studio) onDeployed(data.studio);
    } catch (error) {
      // Soft-fail: UI still shows pause/resume
      console.error(error);
    } finally {
      setHealthLoading(false);
    }
  }, [hermesConfig, isHermesCron, processId, onDeployed]);

  useEffect(() => {
    if (!alreadyDeployed || !isHermesCron || !hermesConfig) return;
    void refreshHealth();
  }, [alreadyDeployed, isHermesCron, hermesConfig?.baseUrl, hermesConfig?.apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleControl(action: "pause" | "resume") {
    if (!hermesConfig) {
      toast.error("Connect Hermes to control cron jobs");
      return;
    }
    setControlling(true);
    try {
      const res = await fetch(`/api/processes/${processId}/automation/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hermesApiBody(hermesConfig), action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      if (data.studio) onDeployed(data.studio);
      if (data.health) setHealth(data.health);
      toast.success(action === "pause" ? "Cron paused" : "Cron resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setControlling(false);
    }
  }

  const allCredentialsMapped =
    integrations.length === 0 ||
    integrations.every((i) => Boolean(credentialMap[i.name]?.id));

  async function handleDeploy() {
    if (!hermesConfig || !canDeploy) return;

    setDeploying(true);
    try {
      const body: Record<string, unknown> = {
        type: deployType,
        hermesBaseUrl: hermesConfig.baseUrl,
        hermesApiKey: hermesConfig.apiKey,
        schedule,
        deliver,
        credentialMap,
        hermesAgentProfileId: selectedAgentId || null,
        forgeBaseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      };

      if (deployType === "n8n_workflow") {
        if (!n8nConfig) {
          onOpenN8nConnection();
          toast.error("Connect n8n before deploying a workflow");
          return;
        }
        body.n8nBaseUrl = n8nConfig.baseUrl;
        body.n8nApiKey = n8nConfig.apiKey;
      }

      const res = await fetch(`/api/processes/${processId}/automation/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deploy failed");

      onDeployed(data.studio);
      toast.success(
        deployType === "hermes_cron" ? "Hermes cron job created" : "n8n workflow created (inactive)"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  async function handleAgentSelect(agentId: string) {
    setAssigningAgent(true);
    try {
      await onAgentChange(agentId || null);
    } finally {
      setAssigningAgent(false);
    }
  }

  async function handleSimulateContent() {
    if (!simTitle.trim()) {
      toast.error("Add a title for the draft");
      return;
    }
    setSimulating(true);
    try {
      const res = await fetch(`/api/processes/${processId}/automation/simulate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: simTitle.trim(),
          bodyMarkdown: simBody,
          status: "review",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Draft added to Content — review it there");
      setSimTitle("");
      setSimBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create content");
    } finally {
      setSimulating(false);
    }
  }

  if (alreadyDeployed) {
    const statusTone =
      automation.status === "paused"
        ? "text-amber-400"
        : automation.status === "failed"
          ? "text-rose-400"
          : "text-emerald-400";

    return (
      <div className="p-4 border-t border-zinc-800 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Deployed</div>
        <p className={`text-xs ${statusTone}`}>
          {automation.type === "n8n_workflow" ? "n8n workflow" : "Hermes cron"} ·{" "}
          {automation.status}
        </p>
        {assignedAgent && (
          <p className="text-xs text-zinc-400">
            Agent: <span className="text-zinc-200">{assignedAgent.displayName}</span>
          </p>
        )}
        {automation.externalUrl && (
          <a
            href={automation.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs w-full flex items-center justify-center gap-2"
          >
            Open in n8n <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {isHermesCron && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1.5"
                disabled={controlling || !hermesConnected || isPaused}
                onClick={() => void handleControl("pause")}
                title={!hermesConnected ? "Connect Hermes first" : "Pause scheduled runs"}
              >
                {controlling && !isPaused ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                Pause
              </button>
              <button
                type="button"
                className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1.5"
                disabled={controlling || !hermesConnected || !isPaused}
                onClick={() => void handleControl("resume")}
                title={!hermesConnected ? "Connect Hermes first" : "Resume scheduled runs"}
              >
                {controlling && isPaused ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Resume
              </button>
              <button
                type="button"
                className="btn-secondary text-xs px-2 flex items-center justify-center"
                disabled={healthLoading || !hermesConnected}
                onClick={() => void refreshHealth()}
                title="Refresh run health"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {!hermesConnected && (
              <p className="text-[10px] text-amber-400">
                Connect Hermes to pause/resume and see run health.
              </p>
            )}
            <RunHealthCard health={health} loading={healthLoading && !health} />
            <p className="text-[10px] text-zinc-500">
              Job ID: {automation.externalId}
            </p>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-1.5">
              <p className="text-[10px] text-emerald-300/90 font-medium flex items-center gap-1.5">
                <Newspaper className="w-3 h-3" /> Content handoff enabled
              </p>
              <p className="text-[10px] text-zinc-500">
                Cron prompts include a Forge ingest URL. When Hermes can HTTP POST, drafts land
                in Content as <span className="text-zinc-400">review</span>. You get an in-app
                notification.
              </p>
              <Link
                href="/content"
                className="text-[10px] text-accent hover:underline inline-block"
              >
                Open Content →
              </Link>
            </div>
            <div className="space-y-2 pt-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Simulate content handoff
              </div>
              <p className="text-[10px] text-zinc-600">
                Test without waiting for a cron run (or when Hermes has no HTTP tools).
              </p>
              <input
                className="input w-full text-xs"
                placeholder="Draft title"
                value={simTitle}
                onChange={(e) => setSimTitle(e.target.value)}
              />
              <textarea
                className="input w-full text-xs min-h-[4.5rem] resize-y"
                placeholder="Body (markdown)…"
                value={simBody}
                onChange={(e) => setSimBody(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary text-xs w-full flex items-center justify-center gap-1.5"
                disabled={simulating || !simTitle.trim()}
                onClick={() => void handleSimulateContent()}
              >
                {simulating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Newspaper className="w-3.5 h-3.5" />
                )}
                Send draft to Content
              </button>
            </div>
          </>
        )}
        {automation.type === "n8n_workflow" && automation.status === "needs_credentials" && (
          <p className="text-[10px] text-amber-400">
            Workflow created inactive. Verify credential bindings in n8n, then activate.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-zinc-800 space-y-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
        <Rocket className="w-3 h-3" /> Deploy
      </div>

      {!plan?.summary ? (
        <p className="text-xs text-zinc-500">
          Complete the automation plan in Hermes chat (right dock) before deploying.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeployType("hermes_cron")}
              className={`flex-1 text-xs py-2 px-2 rounded-lg border transition-colors ${
                deployType === "hermes_cron"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              Hermes cron
            </button>
            <button
              type="button"
              onClick={() => setDeployType("n8n_workflow")}
              title="Advanced: multi-app workflows (n8n). Prefer Hermes cron for agent content loops."
              className={`flex-1 text-xs py-2 px-2 rounded-lg border transition-colors ${
                deployType === "n8n_workflow"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              n8n (advanced)
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500">Hired agent owner</label>
            {hiredAgents.length === 0 ? (
              <p className="text-xs text-amber-400">
                No hired agents.{" "}
                <Link href="/personnel/hire" className="underline hover:text-amber-300">
                  Hire from Personnel
                </Link>{" "}
                before deploying a Hermes cron job.
              </p>
            ) : (
              <select
                className="input w-full text-xs"
                value={selectedAgentId}
                disabled={assigningAgent || deploying}
                onChange={(e) => void handleAgentSelect(e.target.value)}
              >
                <option value="">Select agent…</option>
                {hiredAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.displayName}
                    {agent.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-zinc-600">
              The agent owns this automation and is injected into Hermes cron prompts.
            </p>
          </div>

          {deployType === "hermes_cron" && (
            <div className="space-y-2">
              {!hermesConnected && (
                <p className="text-xs text-amber-400">Connect Hermes to deploy cron jobs.</p>
              )}
              {needsAgentForCron && hiredAgents.length > 0 && (
                <p className="text-xs text-amber-400">Select a hired agent to deploy a cron job.</p>
              )}
              <div>
                <label className="text-[10px] text-zinc-500">Schedule</label>
                <input
                  className="input w-full text-xs mt-1"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="every 1d at 09:00"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500">Delivery</label>
                <select
                  className="input w-full text-xs mt-1"
                  value={deliver}
                  onChange={(e) => setDeliver(e.target.value)}
                >
                  {DELIVER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {deployType === "n8n_workflow" && (
            <div className="space-y-2">
              {!n8nConnected ? (
                <button
                  type="button"
                  onClick={onOpenN8nConnection}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Connect n8n to deploy workflows →
                </button>
              ) : (
                <>
                  <div className="text-[10px] text-zinc-500">Credential mapping</div>
                  <CredentialChecklist
                    integrations={integrations}
                    credentialMap={credentialMap}
                    onChange={onCredentialMapChange}
                    disabled={deploying}
                  />
                </>
              )}
              <p className="text-[10px] text-zinc-600">
                Deploys as an inactive draft. Activate in n8n after verifying bindings.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={
              !canDeploy ||
              !hermesConnected ||
              needsAgentForCron ||
              (deployType === "n8n_workflow" && (!n8nConnected || !allCredentialsMapped))
            }
            onClick={() => void handleDeploy()}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            {deploying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy {deployType === "hermes_cron" ? "cron job" : "workflow"}
              </>
            )}
          </button>

          {deployStatus === "ready_to_deploy" && (
            <p className="text-[10px] text-emerald-400">Plan marked ready to deploy.</p>
          )}
        </>
      )}
    </div>
  );
}