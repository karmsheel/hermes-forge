"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plug } from "lucide-react";
import iconImage from "@/assets/icon.jpg";
import { loadHermesConfig } from "@/lib/hermes-storage";
import { GatewayConnectingOverlay } from "./GatewayConnectingOverlay";
import { HermesConnectionErrorModal } from "./HermesConnectionErrorModal";
import { HermesSplashScreen } from "./HermesSplashScreen";
import { useHermesConnection } from "./HermesConnectionProvider";

const SPLASH_MS = 3000;

type StartupPhase = "splash" | "connecting" | "idle" | "leaving";

export function HermesStartupScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/business-manager";
  const {
    isConnected,
    isBusy,
    autoConnect,
    testConnection,
    setupApiServer,
    restartGateway,
    status,
  } = useHermesConnection();

  const splashDone = useRef(false);
  const autoConnectStarted = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<StartupPhase>("splash");
  const [splashLeaving, setSplashLeaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Splash → always attempt auto-connect (saved config and/or local discover)
  useEffect(() => {
    if (!mounted || splashDone.current) return;

    const timer = window.setTimeout(() => {
      splashDone.current = true;
      setSplashLeaving(true);
      window.setTimeout(() => {
        setSplashLeaving(false);
        setPhase("connecting");
      }, 520);
    }, SPLASH_MS);

    return () => window.clearTimeout(timer);
  }, [mounted]);

  const refreshDiscovery = useCallback(async () => {
    try {
      const res = await fetch("/api/hermes/discover", { method: "POST" });
      const text = await res.text();
      if (!text.trim() || text.trim().startsWith("<")) {
        setHasApiKey(null);
        return null;
      }
      const data = JSON.parse(text) as { hasApiKey?: boolean };
      setHasApiKey(Boolean(data.hasApiKey));
      return data;
    } catch {
      setHasApiKey(null);
      return null;
    }
  }, []);

  /**
   * After splash: try saved credentials first, then full local discover.
   * Previously the screen only set phase "connecting" and never called autoConnect().
   */
  useEffect(() => {
    if (phase !== "connecting") return;
    if (autoConnectStarted.current) return;
    if (isConnected) return;

    autoConnectStarted.current = true;

    void (async () => {
      let ok = false;
      try {
        const saved = loadHermesConfig();
        if (saved?.baseUrl && saved.apiKey) {
          ok = await testConnection(saved);
        }
        if (!ok) {
          ok = await autoConnect();
        }
      } finally {
        // leave phase transitions to the isConnected / failure handlers below
      }

      if (!ok) {
        await refreshDiscovery();
        setErrorModalOpen(true);
        setPhase("idle");
      }
    })();
  }, [phase, isConnected, testConnection, autoConnect, refreshDiscovery]);

  // Connected → leave startup
  useEffect(() => {
    if (!splashDone.current || phase === "splash") return;

    if (isConnected) {
      setErrorModalOpen(false);
      setPhase("leaving");
    }
  }, [isConnected, phase]);

  // Provider may still be testing a saved config while splash is up —
  // keep showing the connecting overlay once splash is done.
  useEffect(() => {
    if (!splashDone.current) return;
    if (phase === "leaving" || phase === "splash") return;
    if (isBusy && phase === "idle") {
      setPhase("connecting");
    }
  }, [isBusy, phase]);

  const handleExitComplete = useCallback(() => {
    void (async () => {
      // After Hermes connects: skip sign-in when a session already exists
      // (returning users / after prior local choice). Otherwise show chooser.
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (data?.user) {
          router.push(redirectTo);
          return;
        }
      } catch {
        /* fall through to sign-in */
      }

      const dest = `/sign-in?from=${encodeURIComponent(redirectTo)}`;
      router.push(dest);
    })();
  }, [redirectTo, router]);

  async function handleConnect() {
    setErrorModalOpen(false);
    setActionMessage(null);
    setConnecting(true);
    setPhase("connecting");
    // Allow manual retry even if the automatic attempt already ran
    autoConnectStarted.current = true;

    let connected = false;
    try {
      const saved = loadHermesConfig();
      if (saved?.baseUrl && saved.apiKey) {
        connected = await testConnection(saved);
      }
      if (!connected) {
        connected = await autoConnect();
      }
    } finally {
      setConnecting(false);
    }

    if (!connected) {
      await refreshDiscovery();
      setErrorModalOpen(true);
      setPhase("idle");
    }
  }

  async function handleSetupApiServer() {
    setSettingUp(true);
    setActionMessage(null);
    try {
      const result = await setupApiServer();
      if (result.ok) {
        setHasApiKey(true);
        setActionMessage(result.message || "API server settings updated.");
        if (result.gatewayReachable) {
          setErrorModalOpen(false);
        }
      } else {
        setActionMessage(result.error || result.message || "API server setup failed.");
      }
    } finally {
      setSettingUp(false);
    }
  }

  async function handleRestartGateway() {
    setRestarting(true);
    setActionMessage(null);
    try {
      const result = await restartGateway();
      if (result.ok) {
        setActionMessage(result.message || "Gateway restarted.");
        setErrorModalOpen(false);
      } else {
        setActionMessage(result.error || result.message || "Gateway restart failed.");
      }
    } finally {
      setRestarting(false);
    }
  }

  if (!mounted) {
    return <GatewayConnectingOverlay />;
  }

  if (phase === "splash") {
    return <HermesSplashScreen leaving={splashLeaving} />;
  }

  if (phase === "connecting" || phase === "leaving") {
    return (
      <>
        <GatewayConnectingOverlay
          leaving={phase === "leaving"}
          onExitComplete={handleExitComplete}
        />
        <HermesConnectionErrorModal
          open={errorModalOpen}
          onClose={() => setErrorModalOpen(false)}
          error={status.error}
          kind={status.kind}
          hasApiKey={hasApiKey}
          settingUp={settingUp}
          restarting={restarting}
          actionMessage={actionMessage}
          onEnableApiServer={() => void handleSetupApiServer()}
          onRestartGateway={() => void handleRestartGateway()}
        />
      </>
    );
  }

  return (
    <>
      <div className="app-shell flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-6">
              <Image
                src={iconImage}
                alt="Hermes Forge"
                className="w-9 h-9 rounded-lg object-cover"
                width={36}
                height={36}
                priority
              />
              <span className="font-semibold text-lg tracking-tight">Hermes Forge</span>
            </div>

            <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.35em] text-accent mb-4">
              Hermes Agent
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">Connect to Hermes</h1>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Hermes Forge runs on your machine and talks to a local Hermes gateway — the same way
              the Hermes Browser Extension connects on startup.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={connecting || isBusy}
            className="btn-primary w-full justify-center"
          >
            {connecting || isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plug className="w-4 h-4" />
                Connect to Hermes
              </>
            )}
          </button>

          <p className="text-xs text-text-soft mt-4">
            Make sure Hermes Agent is installed locally. If connection fails, we will help you
            enable the API server and restart the gateway.
          </p>
        </div>
      </div>

      <HermesConnectionErrorModal
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        error={status.error}
        kind={status.kind}
        hasApiKey={hasApiKey}
        settingUp={settingUp}
        restarting={restarting}
        actionMessage={actionMessage}
        onEnableApiServer={() => void handleSetupApiServer()}
        onRestartGateway={() => void handleRestartGateway()}
      />
    </>
  );
}
