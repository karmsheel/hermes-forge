"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useHermesConnection } from "./HermesConnectionProvider";
import type { HermesConfig } from "@/lib/types";

interface HermesConnectionPanelProps {
  compact?: boolean;
  className?: string;
}

function troubleshootingTip(kind?: string): string | null {
  switch (kind) {
    case "not_running":
      return "Start Hermes with `hermes gateway` and ensure API_SERVER_ENABLED=true in ~/.hermes/.env";
    case "auth_failed":
      return "Your API key does not match API_SERVER_KEY in ~/.hermes/.env";
    case "misconfigured":
      return "Enable the API server in ~/.hermes/.env, then restart the gateway";
    case "timeout":
      return "Hermes took too long to respond. Check that the gateway is running locally.";
    default:
      return null;
  }
}

export function HermesConnectionPanel({ compact = false, className = "" }: HermesConnectionPanelProps) {
  const {
    config,
    status,
    isConnected,
    isBusy,
    autoConnect,
    saveConnection,
    testConnection,
    disconnect,
    refresh,
  } = useHermesConnection();

  const [manualOpen, setManualOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "http://127.0.0.1:8642");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl);
      setApiKey(config.apiKey);
    }
  }, [config]);

  async function handleSaveManual() {
    setSaving(true);
    try {
      const next: HermesConfig = { baseUrl: baseUrl.trim(), apiKey: apiKey.trim() };
      await saveConnection(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestManual() {
    setSaving(true);
    try {
      await testConnection({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    } finally {
      setSaving(false);
    }
  }

  const tip = troubleshootingTip(status.kind);

  return (
    <div className={`card p-4 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            Hermes Agent
          </div>
          <div className="flex items-center gap-2">
            {isBusy ? (
              <Loader2 className="w-4 h-4 text-text-muted animate-spin shrink-0" />
            ) : isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-medium">
              {isBusy
                ? status.state === "discovering"
                  ? "Looking for Hermes..."
                  : "Testing connection..."
                : isConnected
                  ? "Connected"
                  : "Not connected"}
            </span>
          </div>
          {isConnected && config && (
            <div className="mt-1 text-[11px] text-text-muted font-mono truncate">
              {config.baseUrl}
              {status.latencyMs != null && (
                <span className="text-text-soft"> · {status.latencyMs}ms</span>
              )}
            </div>
          )}
          {status.model && isConnected && (
            <div className="mt-1 text-[11px] text-green">
              Model: {status.model}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isBusy || saving}
            className="p-2 rounded-lg hover:bg-bg-muted text-text-muted hover:text-text-strong transition-colors disabled:opacity-50"
            title="Refresh connection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`} />
          </button>
          {isConnected ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={isBusy || saving}
              className="p-2 rounded-lg hover:bg-bg-muted text-text-muted hover:text-text-strong transition-colors disabled:opacity-50"
              title="Disconnect"
            >
              <Unplug className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void autoConnect()}
              disabled={isBusy || saving}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Plug className="w-3.5 h-3.5" /> Connect
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!isConnected && status.error && (
        <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {status.error}
          {tip && <div className="mt-1.5 text-text-muted">{tip}</div>}
        </div>
      )}

      {!compact && isConnected && status.features && status.features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {status.features.slice(0, 6).map((feature) => (
            <span
              key={feature}
              className="text-[10px] px-2 py-0.5 rounded-full bg-bg-muted text-text-muted border border-border-strong"
            >
              {feature.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors"
        >
          {manualOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Manual connection
        </button>

        {manualOpen && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">API URL</label>
              <input
                className="input w-full mt-1 text-sm font-mono"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8642"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">API Key</label>
              <input
                className="input w-full mt-1 text-sm font-mono"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="From API_SERVER_KEY in ~/.hermes/.env"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleTestManual()}
                disabled={saving || isBusy || !baseUrl.trim() || !apiKey.trim()}
                className="btn-secondary text-xs flex-1 justify-center"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveManual()}
                disabled={saving || isBusy || !baseUrl.trim() || !apiKey.trim()}
                className="btn-primary text-xs flex-1 justify-center"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}