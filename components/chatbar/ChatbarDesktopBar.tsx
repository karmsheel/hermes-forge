"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Check, ClipboardCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import {
  contextMeterDisplay,
  type ContextMeterInput,
} from "@/lib/chatbar/context-meter";
import {
  buildChatbarDiagnostics,
  copyTextToClipboard,
  type DiagnosticsInput,
} from "@/lib/chatbar/diagnostics";
import { formatChatbarAgentLabel } from "@/lib/chatbar/agent-label";
import { formatModelLabel, resolveHermesModel } from "@/lib/hermes-models";
import type { ChatbarAgentOption } from "@/lib/types";

export type ChatbarAgentPickerProps = {
  agents: ChatbarAgentOption[];
  activeAgentId: string | null;
  overlordProfileKey?: string | null;
  loading?: boolean;
  /** When true, only Overlord is selectable (Business Manager, Workshop). */
  overlordOnly?: boolean;
  disabled?: boolean;
  onSelectAgent: (agentId: string) => void;
};

export type ChatbarDesktopBarProps = {
  meterInput: ContextMeterInput;
  diagnosticsInput: Omit<
    DiagnosticsInput,
    "hermesBaseUrl" | "hermesModel" | "hermesFeatures" | "connectionState" | "connectionKind" | "connectionError" | "latencyMs" | "userAgent" | "platform"
  >;
  disabled?: boolean;
  /** Studio mode: hired agents + Overlord. Omitted in process/automation docks. */
  agentPicker?: ChatbarAgentPickerProps | null;
  /**
   * When false, hide the model picker (studio composer places it under the
   * textarea on the left next to send actions). Default true for process/automation docks.
   */
  showModel?: boolean;
};

export type ChatbarModelSelectProps = {
  disabled?: boolean;
  /** Optional id suffix so multiple mounts never collide. */
  id?: string;
  className?: string;
};

/**
 * Standalone model picker for the studio composer toolbar (under textarea, left).
 */
export function ChatbarModelSelect({
  disabled = false,
  id = "chatbar-model",
  className,
}: ChatbarModelSelectProps) {
  const {
    isConnected,
    availableModels,
    modelsLoading,
    selectedModel,
    setModel,
    config,
    refreshModels,
  } = useHermesConnection();

  const modelOptions = useMemo(() => {
    const list = [...availableModels];
    const current = selectedModel || (config ? resolveHermesModel(config) : null);
    if (current && !list.some((m) => m.id === current)) {
      list.unshift({ id: current, label: formatModelLabel(current) });
    }
    if (list.length === 0 && current) {
      list.push({ id: current, label: formatModelLabel(current) });
    }
    return list;
  }, [availableModels, selectedModel, config]);

  /** Prefer the real selected model; never fall back to option[0] while empty. */
  const modelSelectValue = selectedModel || (config ? resolveHermesModel(config) : "") || "";

  const onModelChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (!next) return;
      setModel(next);
    },
    [setModel],
  );

  const modelTitle =
    "Hermes model / profile id. The request model field is cosmetic — the real LLM is set server-side in Hermes (config.yaml / profile), not by this picker alone.";

  return (
    <div
      className={["chatbar-desktop-bar__model", className].filter(Boolean).join(" ")}
    >
      <label className="chatbar-desktop-bar__label" htmlFor={id} title={modelTitle}>
        Model
      </label>
      <select
        id={id}
        className="chatbar-desktop-bar__select"
        value={
          modelOptions.some((m) => m.id === modelSelectValue)
            ? modelSelectValue
            : modelOptions[0]?.id || ""
        }
        disabled={disabled || !isConnected || modelOptions.length === 0}
        onChange={onModelChange}
        onFocus={() => {
          if (isConnected && availableModels.length === 0 && !modelsLoading) {
            void refreshModels();
          }
        }}
        title={modelTitle}
        aria-description={modelTitle}
      >
        {modelOptions.length === 0 ? (
          <option value="">{isConnected ? "No models" : "Connect Hermes"}</option>
        ) : (
          modelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))
        )}
      </select>
      {modelsLoading ? (
        <Loader2 className="chatbar-desktop-bar__spin w-3 h-3 animate-spin" aria-hidden />
      ) : null}
    </div>
  );
}

/**
 * Footer dock: agent picker + model picker + context meter (PR-6).
 * Agent and Model are separate controls — agents are hired personas;
 * models are LLM backends for the active session.
 */
export function ChatbarDesktopBar({
  meterInput,
  diagnosticsInput,
  disabled = false,
  agentPicker = null,
  showModel = true,
}: ChatbarDesktopBarProps) {
  const {
    selectedModel,
    config,
    status,
  } = useHermesConnection();
  const { showChatbarDiagnostics } = useDeveloperSettings();
  const [copied, setCopied] = useState(false);

  const meter = useMemo(() => contextMeterDisplay(meterInput), [meterInput]);

  const onAgentChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (!next || !agentPicker) return;
      agentPicker.onSelectAgent(next);
    },
    [agentPicker],
  );

  const onCopyDiagnostics = useCallback(async () => {
    const blob = buildChatbarDiagnostics({
      ...diagnosticsInput,
      hermesBaseUrl: config?.baseUrl ?? status.baseUrl ?? null,
      hermesModel: selectedModel ?? status.model ?? null,
      hermesFeatures: status.features ?? null,
      connectionState: status.state,
      connectionKind: status.kind ?? null,
      connectionError: status.error ?? null,
      latencyMs: status.latencyMs ?? null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
    });
    const ok = await copyTextToClipboard(blob);
    if (ok) {
      setCopied(true);
      toast.success("Diagnostics copied (secrets redacted)");
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy diagnostics");
    }
  }, [diagnosticsInput, config, status, selectedModel]);

  const agentDisabled =
    disabled ||
    !agentPicker ||
    agentPicker.disabled ||
    agentPicker.loading ||
    agentPicker.overlordOnly ||
    agentPicker.agents.length <= 1;

  return (
    <div className="chatbar-desktop-bar" aria-label="Agent, model, and context">
      {agentPicker ? (
        <div className="chatbar-desktop-bar__agent">
          <label className="chatbar-desktop-bar__label" htmlFor="chatbar-agent">
            Agent
          </label>
          {agentPicker.loading && agentPicker.agents.length === 0 ? (
            <span className="chatbar-desktop-bar__empty" aria-live="polite">
              Loading…
            </span>
          ) : !agentPicker.loading && agentPicker.agents.length === 0 ? (
            <a href="/setup/overlord" className="chatbar-desktop-bar__empty-link">
              Set Overlord
            </a>
          ) : (
            <select
              id="chatbar-agent"
              className="chatbar-desktop-bar__select"
              value={agentPicker.activeAgentId || agentPicker.agents[0]?.id || ""}
              disabled={agentDisabled}
              onChange={onAgentChange}
              title={
                agentPicker.overlordOnly
                  ? "This page is locked to your Forge Overlord. On other rooms you can switch hired agents."
                  : "Talk to a hired Hermes agent — each agent has its own conversation threads"
              }
            >
              {agentPicker.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatChatbarAgentLabel(a, agentPicker.overlordProfileKey)}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {showModel ? <ChatbarModelSelect disabled={disabled} /> : null}

      <div
        className={`chatbar-desktop-bar__meter chatbar-desktop-bar__meter--${meter.level}`}
        title={meter.title}
        role="meter"
        aria-valuenow={meter.percentUsed ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={meter.detail}
      >
        <div className="chatbar-desktop-bar__meter-track" aria-hidden>
          <div
            className="chatbar-desktop-bar__meter-fill"
            style={{
              width: `${Math.min(100, meter.percentUsed ?? 0)}%`,
            }}
          />
        </div>
        <span className="chatbar-desktop-bar__meter-label">{meter.detail}</span>
      </div>

      {showChatbarDiagnostics ? (
        <button
          type="button"
          className="chatbar-desktop-bar__diag"
          onClick={() => void onCopyDiagnostics()}
          title="Copy redacted support diagnostics"
          aria-label="Copy diagnostics"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" aria-hidden />
          ) : (
            <ClipboardCopy className="w-3.5 h-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
