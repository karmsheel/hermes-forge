"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Rocket } from "lucide-react";
import { CredentialChecklist } from "./CredentialChecklist";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useN8nConnection } from "@/components/n8n/N8nConnectionProvider";
import type {
  AutomationPlan,
  AutomationStudioData,
  CredentialMap,
  IntegrationRequirement,
} from "@/lib/automation-types";
import type { AutomationDeployStatus } from "@/lib/process-status";

type DeployType = "hermes_cron" | "n8n_workflow";

interface DeployPanelProps {
  processId: string;
  plan: AutomationPlan | null;
  integrations: IntegrationRequirement[];
  credentialMap: CredentialMap;
  automation: AutomationStudioData["automation"];
  deployStatus: AutomationDeployStatus;
  onCredentialMapChange: (map: CredentialMap) => void;
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
  deployStatus,
  onCredentialMapChange,
  onDeployed,
  onOpenN8nConnection,
}: DeployPanelProps) {
  const { config: hermesConfig, isConnected: hermesConnected } = useHermesConnection();
  const { config: n8nConfig, isConnected: n8nConnected } = useN8nConnection();

  const [deployType, setDeployType] = useState<DeployType>(
    plan?.recommendedPath === "n8n_workflow" ? "n8n_workflow" : "hermes_cron"
  );
  const [schedule, setSchedule] = useState(plan?.schedule ?? "every 1d at 09:00");
  const [deliver, setDeliver] = useState(plan?.deliveryChannel ?? "local");
  const [deploying, setDeploying] = useState(false);

  const alreadyDeployed = Boolean(automation.externalId);
  const canDeploy = Boolean(plan?.summary) && !alreadyDeployed && !deploying;

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

  if (alreadyDeployed) {
    return (
      <div className="p-4 border-t border-zinc-800 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Deployed</div>
        <p className="text-xs text-emerald-400">
          {automation.type === "n8n_workflow" ? "n8n workflow" : "Hermes cron"} ·{" "}
          {automation.status}
        </p>
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
        {automation.type === "hermes_cron" && (
          <p className="text-[10px] text-zinc-500">
            Job ID: {automation.externalId}. Manage with <code className="text-zinc-400">hermes cron list</code> or the Hermes dashboard.
          </p>
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
          Complete the automation plan in chat before deploying.
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
              className={`flex-1 text-xs py-2 px-2 rounded-lg border transition-colors ${
                deployType === "n8n_workflow"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              n8n workflow
            </button>
          </div>

          {deployType === "hermes_cron" && (
            <div className="space-y-2">
              {!hermesConnected && (
                <p className="text-xs text-amber-400">Connect Hermes to deploy cron jobs.</p>
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