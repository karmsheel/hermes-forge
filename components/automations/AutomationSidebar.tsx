"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Plug, Zap } from "lucide-react";
import {
  AUTOMATION_DEPLOY_LABELS,
  type AutomationDeployStatus,
} from "@/lib/process-status";
import type {
  AutomationAgentSummary,
  AutomationPlan,
  AutomationStudioData,
  CredentialMap,
  IntegrationRequirement,
} from "@/lib/automation-types";
import { DeployPanel } from "./DeployPanel";

interface AutomationSidebarProps {
  processName: string;
  department: string;
  trigger: string | null;
  inputs: string | null;
  outputs: string | null;
  manualSteps: string | null;
  plan: AutomationPlan | null;
  integrations: IntegrationRequirement[];
  automationStatus: AutomationDeployStatus;
  processId: string;
  automation: AutomationStudioData["automation"];
  hiredAgents: AutomationAgentSummary[];
  assignedAgent: AutomationAgentSummary | null;
  credentialMap: CredentialMap;
  onCredentialMapChange: (map: CredentialMap) => void;
  onAgentChange: (agentId: string | null) => void | Promise<void>;
  onDeployed: (studio: AutomationStudioData) => void;
  onOpenN8nConnection: () => void;
}

function deployBadgeClass(status: AutomationDeployStatus): string {
  switch (status) {
    case "ready_to_deploy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "designing":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "not_started":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    default:
      return "bg-zinc-800 text-zinc-400 border-zinc-700";
  }
}

function pathLabel(path: AutomationPlan["recommendedPath"]): string {
  switch (path) {
    case "hermes_cron":
      return "Hermes cron";
    case "n8n_workflow":
      return "n8n workflow";
    default:
      return "Undecided";
  }
}

export function AutomationSidebar({
  processName,
  department,
  trigger,
  inputs,
  outputs,
  manualSteps,
  plan,
  integrations,
  automationStatus,
  processId,
  automation,
  hiredAgents,
  assignedAgent,
  credentialMap,
  onCredentialMapChange,
  onAgentChange,
  onDeployed,
  onOpenN8nConnection,
}: AutomationSidebarProps) {
  return (
    <aside className="w-80 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <Link
          href="/automations"
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-400 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Automations
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight">Automation Studio</div>
            <div className="text-[10px] text-zinc-500">Design & deploy plan</div>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-zinc-800 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Process</div>
          <div className="text-sm font-medium">{processName}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{department}</div>
        </div>
        <span
          className={`inline-block text-[10px] px-2 py-0.5 rounded border ${deployBadgeClass(automationStatus)}`}
        >
          {AUTOMATION_DEPLOY_LABELS[automationStatus]}
        </span>
      </div>

      <div className="p-4 border-b border-zinc-800 space-y-2 text-xs">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Map context</div>
        {trigger && (
          <div>
            <span className="text-zinc-500">Trigger: </span>
            <span className="text-zinc-300">{trigger}</span>
          </div>
        )}
        {inputs && (
          <div>
            <span className="text-zinc-500">Inputs: </span>
            <span className="text-zinc-300">{inputs}</span>
          </div>
        )}
        {outputs && (
          <div>
            <span className="text-zinc-500">Outputs: </span>
            <span className="text-zinc-300">{outputs}</span>
          </div>
        )}
        {manualSteps && (
          <div>
            <span className="text-zinc-500">Manual: </span>
            <span className="text-zinc-300">{manualSteps}</span>
          </div>
        )}
        {!trigger && !inputs && !outputs && !manualSteps && (
          <p className="text-zinc-500">Structured fields will populate as you map in Workshop.</p>
        )}
      </div>

      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
          <Plug className="w-3 h-3" /> Integrations
        </div>
        {integrations.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Chat with Hermes to identify tools and credentials needed.
          </p>
        ) : (
          <ul className="space-y-2">
            {integrations.map((item) => (
              <li
                key={item.name}
                className="text-xs border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-900/50"
              >
                <div className="font-medium text-zinc-200">{item.name}</div>
                {item.purpose && <div className="text-zinc-500 mt-0.5">{item.purpose}</div>}
                <div
                  className={`text-[10px] mt-1 ${
                    item.status === "configured" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {item.status === "configured" ? "Configured" : "Needs setup"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
          <Clock className="w-3 h-3" /> Automation plan
        </div>
        {!plan?.summary ? (
          <p className="text-xs text-zinc-500">
            Plan will appear here as you discuss cron vs n8n with Hermes.
          </p>
        ) : (
          <div className="space-y-3 text-xs">
            <p className="text-zinc-300 leading-relaxed">{plan.summary}</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {pathLabel(plan.recommendedPath)}
              </span>
              {plan.triggerType !== "undecided" && (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {plan.triggerType}
                </span>
              )}
              {plan.schedule && (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {plan.schedule}
                </span>
              )}
            </div>
            {plan.automatableSteps.length > 0 && (
              <div>
                <div className="text-zinc-500 mb-1">Automate</div>
                <ul className="list-disc list-inside text-zinc-400 space-y-0.5">
                  {plan.automatableSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.manualSteps.length > 0 && (
              <div>
                <div className="text-zinc-500 mb-1">Keep manual</div>
                <ul className="list-disc list-inside text-zinc-400 space-y-0.5">
                  {plan.manualSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>

      <DeployPanel
        processId={processId}
        plan={plan}
        integrations={integrations}
        credentialMap={credentialMap}
        automation={automation}
        hiredAgents={hiredAgents}
        assignedAgent={assignedAgent}
        deployStatus={automationStatus}
        onCredentialMapChange={onCredentialMapChange}
        onAgentChange={onAgentChange}
        onDeployed={onDeployed}
        onOpenN8nConnection={onOpenN8nConnection}
      />
    </aside>
  );
}