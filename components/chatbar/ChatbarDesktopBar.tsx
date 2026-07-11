"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Check, ClipboardCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import {
  contextMeterDisplay,
  type ContextMeterInput,
} from "@/lib/chatbar/context-meter";
import {
  buildChatbarDiagnostics,
  copyTextToClipboard,
  type DiagnosticsInput,
} from "@/lib/chatbar/diagnostics";
import { formatModelLabel, resolveHermesModel } from "@/lib/hermes-models";

export type ChatbarDesktopBarProps = {
  meterInput: ContextMeterInput;
  diagnosticsInput: Omit<
    DiagnosticsInput,
    "hermesBaseUrl" | "hermesModel" | "hermesFeatures" | "connectionState" | "connectionKind" | "connectionError" | "latencyMs" | "userAgent" | "platform"
  >;
  disabled?: boolean;
};

/**
 * Footer dock: model picker, context meter, copy diagnostics (PR-6).
 */
export function ChatbarDesktopBar({
  meterInput,
  diagnosticsInput,
  disabled = false,
}: ChatbarDesktopBarProps) {
  const {
    isConnected,
    availableModels,
    modelsLoading,
    selectedModel,
    setModel,
    config,
    status,
    refreshModels,
  } = useHermesConnection();
  const [copied, setCopied] = useState(false);

  const meter = useMemo(() => contextMeterDisplay(meterInput), [meterInput]);

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

  const onModelChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (!next) return;
      setModel(next);
    },
    [setModel],
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

  return (
    <div className="chatbar-desktop-bar" aria-label="Model and context">
      <div className="chatbar-desktop-bar__model">
        <label className="chatbar-desktop-bar__label" htmlFor="chatbar-model">
          Model
        </label>
        <select
          id="chatbar-model"
          className="chatbar-desktop-bar__select"
          value={selectedModel || modelOptions[0]?.id || ""}
          disabled={disabled || !isConnected || modelOptions.length === 0}
          onChange={onModelChange}
          onFocus={() => {
            if (isConnected && availableModels.length === 0 && !modelsLoading) {
              void refreshModels();
            }
          }}
          title="Model for this Forge session (does not change Hermes global default beyond your saved config)"
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
    </div>
  );
}
