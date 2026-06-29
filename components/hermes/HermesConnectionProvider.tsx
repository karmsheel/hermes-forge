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
import type { HermesConfig, HermesConnectionStatus } from "@/lib/types";
import {
  clearHermesConfig,
  connectionStatusFromProbe,
  defaultHermesConfig,
  loadHermesConfig,
  saveHermesConfig,
} from "@/lib/hermes-storage";

interface HermesConnectionContextValue {
  config: HermesConfig | null;
  status: HermesConnectionStatus;
  isConnected: boolean;
  isBusy: boolean;
  autoConnect: () => Promise<boolean>;
  testConnection: (config?: HermesConfig) => Promise<boolean>;
  saveConnection: (config: HermesConfig) => Promise<boolean>;
  disconnect: () => void;
  refresh: () => Promise<boolean>;
}

const HermesConnectionContext = createContext<HermesConnectionContextValue | null>(null);

const IDLE_STATUS: HermesConnectionStatus = { state: "idle" };

export function HermesConnectionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HermesConfig | null>(null);
  const [status, setStatus] = useState<HermesConnectionStatus>(IDLE_STATUS);
  const bootstrapped = useRef(false);

  const applyProbe = useCallback(
    (probe: Parameters<typeof connectionStatusFromProbe>[0], source: "auto" | "manual" | "saved") => {
      setStatus(connectionStatusFromProbe(probe, source));
      return probe.ok;
    },
    []
  );

  const testConnection = useCallback(
    async (candidate?: HermesConfig): Promise<boolean> => {
      const target = candidate ?? config;
      if (!target?.baseUrl || !target.apiKey) {
        setStatus({
          state: "error",
          error: "Enter a base URL and API key.",
          kind: "misconfigured",
        });
        return false;
      }

      setStatus((prev) => ({ ...prev, state: "testing" }));

      try {
        const res = await fetch("/api/hermes/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: target.baseUrl,
            apiKey: target.apiKey,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setStatus({
            state: "error",
            error: data.error || "Connection test failed",
            kind: "misconfigured",
          });
          return false;
        }

        return applyProbe(data.probe, candidate ? "manual" : "saved");
      } catch (error) {
        setStatus({
          state: "error",
          error: error instanceof Error ? error.message : "Connection test failed",
          kind: "not_running",
        });
        return false;
      }
    },
    [applyProbe, config]
  );

  const saveConnection = useCallback(
    async (next: HermesConfig): Promise<boolean> => {
      const ok = await testConnection(next);
      if (!ok) return false;

      saveHermesConfig(next);
      setConfig(next);
      toast.success("Hermes connected");
      return true;
    },
    [testConnection]
  );

  const autoConnect = useCallback(async (): Promise<boolean> => {
    setStatus({ state: "discovering" });

    try {
      const res = await fetch("/api/hermes/discover", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setStatus({
          state: "error",
          error: data.error || "Auto-discovery failed",
          kind: "misconfigured",
        });
        return false;
      }

      if (!data.suggested?.baseUrl || !data.suggested?.apiKey) {
        applyProbe(data.probe, "auto");
        return false;
      }

      const discovered: HermesConfig = {
        baseUrl: data.suggested.baseUrl,
        apiKey: data.suggested.apiKey,
      };

      saveHermesConfig(discovered);
      setConfig(discovered);
      applyProbe(data.probe, "auto");
      toast.success("Connected to Hermes automatically");
      return true;
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : "Auto-discovery failed",
        kind: "not_running",
      });
      return false;
    }
  }, [applyProbe]);

  const disconnect = useCallback(() => {
    clearHermesConfig();
    setConfig(null);
    setStatus(IDLE_STATUS);
    toast.message("Hermes disconnected");
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (config) return testConnection(config);
    return autoConnect();
  }, [autoConnect, config, testConnection]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const saved = loadHermesConfig();
    if (saved) {
      setConfig(saved);
      void testConnection(saved);
      return;
    }

    void autoConnect();
  }, [autoConnect, testConnection]);

  const value = useMemo<HermesConnectionContextValue>(
    () => ({
      config,
      status,
      isConnected: status.state === "connected",
      isBusy: status.state === "discovering" || status.state === "testing",
      autoConnect,
      testConnection,
      saveConnection,
      disconnect,
      refresh,
    }),
    [autoConnect, config, disconnect, refresh, saveConnection, status, testConnection]
  );

  return (
    <HermesConnectionContext.Provider value={value}>
      {children}
    </HermesConnectionContext.Provider>
  );
}

export function useHermesConnection(): HermesConnectionContextValue {
  const ctx = useContext(HermesConnectionContext);
  if (!ctx) {
    throw new Error("useHermesConnection must be used within HermesConnectionProvider");
  }
  return ctx;
}

export function useHermesConfigOrDefault(): HermesConfig {
  const { config } = useHermesConnection();
  return config ?? defaultHermesConfig();
}