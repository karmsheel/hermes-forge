"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Unplug, XCircle } from "lucide-react";
import { useN8nConnection } from "./N8nConnectionProvider";
import type { N8nConfig } from "@/lib/types";

export function N8nConnectionPanel({ className = "" }: { className?: string }) {
  const { config, status, isConnected, isBusy, saveConnection, testConnection, disconnect } =
    useN8nConnection();

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "http://127.0.0.1:5678");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl);
      setApiKey(config.apiKey);
    }
  }, [config]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveConnection({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setSaving(true);
    try {
      await testConnection({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`card p-4 space-y-4 ${className}`}>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">n8n</div>
        <div className="flex items-center gap-2">
          {isBusy ? (
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          ) : isConnected ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-sm font-medium">
            {isConnected ? "Connected" : isBusy ? "Testing…" : "Not connected"}
          </span>
          {isConnected && status.latencyMs != null && (
            <span className="text-xs text-zinc-500">{status.latencyMs}ms</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-zinc-500">Base URL</label>
        <input
          className="input w-full text-sm"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://127.0.0.1:5678"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-zinc-500">API key</label>
        <input
          className="input w-full text-sm font-mono"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="From n8n Settings → API"
        />
      </div>

      {status.error && !isConnected && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {status.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={saving || !baseUrl || !apiKey}
          className="btn-secondary text-sm flex-1"
        >
          Test
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !baseUrl || !apiKey}
          className="btn-primary text-sm flex-1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
        </button>
      </div>

      {isConnected && (
        <button
          type="button"
          onClick={disconnect}
          className="btn-secondary text-sm w-full flex items-center justify-center gap-2"
        >
          <Unplug className="w-4 h-4" /> Disconnect
        </button>
      )}

      <p className="text-[10px] text-zinc-600">
        Create an API key in your n8n instance under Settings → n8n API. Forge stores it locally
        only.
      </p>
    </div>
  );
}