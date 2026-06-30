"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { N8nConfig, N8nConnectionStatus } from "@/lib/types";
import {
  clearN8nConfig,
  defaultN8nConfig,
  loadN8nConfig,
  saveN8nConfig,
} from "@/lib/n8n-storage";

interface N8nConnectionContextValue {
  config: N8nConfig | null;
  status: N8nConnectionStatus;
  isConnected: boolean;
  isBusy: boolean;
  testConnection: (config?: N8nConfig) => Promise<boolean>;
  saveConnection: (config: N8nConfig) => Promise<boolean>;
  disconnect: () => void;
  refresh: () => Promise<boolean>;
}

const N8nConnectionContext = createContext<N8nConnectionContextValue | null>(null);

const IDLE_STATUS: N8nConnectionStatus = { state: "idle" };

export function N8nConnectionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<N8nConfig | null>(null);
  const [status, setStatus] = useState<N8nConnectionStatus>(IDLE_STATUS);
  const bootstrapped = useRef(false);

  const testConnection = useCallback(async (candidate?: N8nConfig): Promise<boolean> => {
    const target = candidate ?? config;
    if (!target?.baseUrl || !target.apiKey) {
      setStatus({ state: "error", error: "Enter n8n base URL and API key." });
      return false;
    }

    setStatus({ state: "testing" });

    try {
      const res = await fetch("/api/n8n/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: target.baseUrl,
          apiKey: target.apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.probe?.ok) {
        setStatus({
          state: "error",
          error: data.probe?.error || data.error || "Connection test failed",
        });
        return false;
      }

      setStatus({
        state: "connected",
        latencyMs: data.probe.latencyMs,
      });
      return true;
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : "Connection test failed",
      });
      return false;
    }
  }, [config]);

  const saveConnection = useCallback(
    async (next: N8nConfig): Promise<boolean> => {
      const ok = await testConnection(next);
      if (!ok) return false;
      saveN8nConfig(next);
      setConfig(next);
      toast.success("n8n connected");
      return true;
    },
    [testConnection]
  );

  const disconnect = useCallback(() => {
    clearN8nConfig();
    setConfig(null);
    setStatus(IDLE_STATUS);
    toast.message("n8n disconnected");
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    return testConnection(config);
  }, [config, testConnection]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const saved = loadN8nConfig();
    if (saved) {
      setConfig(saved);
      void testConnection(saved);
    }
  }, [testConnection]);

  const value = useMemo<N8nConnectionContextValue>(
    () => ({
      config,
      status,
      isConnected: status.state === "connected",
      isBusy: status.state === "testing",
      testConnection,
      saveConnection,
      disconnect,
      refresh,
    }),
    [config, disconnect, refresh, saveConnection, status, testConnection]
  );

  return <N8nConnectionContext.Provider value={value}>{children}</N8nConnectionContext.Provider>;
}

export function useN8nConnection(): N8nConnectionContextValue {
  const ctx = useContext(N8nConnectionContext);
  if (!ctx) {
    throw new Error("useN8nConnection must be used within N8nConnectionProvider");
  }
  return ctx;
}

export function useN8nConfigOrDefault(): N8nConfig {
  const { config } = useN8nConnection();
  return config ?? defaultN8nConfig();
}