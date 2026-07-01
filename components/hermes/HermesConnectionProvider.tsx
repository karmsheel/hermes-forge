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
import { type HermesModelOption, resolveHermesModel } from "@/lib/hermes-models";
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
  availableModels: HermesModelOption[];
  modelsLoading: boolean;
  selectedModel: string | null;
  autoConnect: () => Promise<boolean>;
  testConnection: (config?: HermesConfig) => Promise<boolean>;
  saveConnection: (config: HermesConfig) => Promise<boolean>;
  disconnect: () => void;
  refresh: () => Promise<boolean>;
  setModel: (model: string) => void;
  refreshModels: () => Promise<void>;
}

const HermesConnectionContext = createContext<HermesConnectionContextValue | null>(null);

const IDLE_STATUS: HermesConnectionStatus = { state: "idle" };

function withResolvedModel(
  next: HermesConfig,
  fallback?: string
): HermesConfig {
  return {
    ...next,
    model: resolveHermesModel(next, fallback),
  };
}

export function HermesConnectionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HermesConfig | null>(null);
  const [status, setStatus] = useState<HermesConnectionStatus>(IDLE_STATUS);
  const [availableModels, setAvailableModels] = useState<HermesModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const bootstrapped = useRef(false);

  const applyProbe = useCallback(
    (
      probe: Parameters<typeof connectionStatusFromProbe>[0],
      source: "auto" | "manual" | "saved",
      activeConfig?: HermesConfig | null
    ) => {
      setStatus(connectionStatusFromProbe(probe, source));

      if (probe.ok && activeConfig) {
        const resolved = withResolvedModel(activeConfig, probe.model);
        if (resolved.model !== activeConfig.model) {
          setConfig(resolved);
          saveHermesConfig(resolved);
        }
      }

      return probe.ok;
    },
    []
  );

  const refreshModels = useCallback(async (): Promise<void> => {
    if (!config?.baseUrl || !config.apiKey) {
      setAvailableModels([]);
      return;
    }

    setModelsLoading(true);
    try {
      const res = await fetch("/api/hermes/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        }),
      });

      if (!res.ok) {
        setAvailableModels([]);
        return;
      }

      const data = await res.json();
      const models: HermesModelOption[] = data.models ?? [];
      setAvailableModels(models);

      if (models.length > 0 && config) {
        const hasSelected = models.some((model) => model.id === config.model);
        if (!hasSelected) {
          const next = withResolvedModel(config, models[0].id);
          setConfig(next);
          saveHermesConfig(next);
        }
      }
    } catch {
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [config]);

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

        const normalized = withResolvedModel(target, data.probe?.model);
        if (candidate) {
          setConfig(normalized);
        }

        return applyProbe(data.probe, candidate ? "manual" : "saved", normalized);
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

      const saved = withResolvedModel(next, status.model);
      saveHermesConfig(saved);
      setConfig(saved);
      toast.success("Hermes connected");
      return true;
    },
    [status.model, testConnection]
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

      const discovered = withResolvedModel(
        {
          baseUrl: data.suggested.baseUrl,
          apiKey: data.suggested.apiKey,
        },
        data.probe?.model
      );

      saveHermesConfig(discovered);
      setConfig(discovered);
      applyProbe(data.probe, "auto", discovered);
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
    setAvailableModels([]);
    setStatus(IDLE_STATUS);
    toast.message("Hermes disconnected");
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (config) return testConnection(config);
    return autoConnect();
  }, [autoConnect, config, testConnection]);

  const setModel = useCallback(
    (model: string) => {
      if (!config) return;
      const trimmed = model.trim();
      if (!trimmed || trimmed === config.model) return;

      const next = { ...config, model: trimmed };
      setConfig(next);
      saveHermesConfig(next);
      toast.success(`Model set to ${trimmed}`);
    },
    [config]
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const saved = loadHermesConfig();
    if (saved) {
      const normalized = withResolvedModel(saved);
      setConfig(normalized);
      void testConnection(normalized);
      return;
    }

    void autoConnect();
  }, [autoConnect, testConnection]);

  useEffect(() => {
    if (status.state === "connected" && config) {
      void refreshModels();
    } else if (status.state !== "connected") {
      setAvailableModels([]);
    }
  }, [config, refreshModels, status.state]);

  const selectedModel = config?.model ?? status.model ?? null;

  const value = useMemo<HermesConnectionContextValue>(
    () => ({
      config,
      status,
      isConnected: status.state === "connected",
      isBusy: status.state === "discovering" || status.state === "testing",
      availableModels,
      modelsLoading,
      selectedModel,
      autoConnect,
      testConnection,
      saveConnection,
      disconnect,
      refresh,
      setModel,
      refreshModels,
    }),
    [
      autoConnect,
      availableModels,
      config,
      disconnect,
      modelsLoading,
      refresh,
      refreshModels,
      saveConnection,
      selectedModel,
      setModel,
      status,
      testConnection,
    ]
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