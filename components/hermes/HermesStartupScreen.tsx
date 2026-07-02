"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plug } from "lucide-react";
import iconImage from "@/assets/icon.jpg";
import { loadHermesConfig } from "@/lib/hermes-storage";
import { GatewayConnectingOverlay } from "./GatewayConnectingOverlay";
import { useHermesConnection } from "./HermesConnectionProvider";

type StartupPhase = "boot" | "connecting" | "idle" | "leaving";

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

export function HermesStartupScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/home";
  const { isConnected, isBusy, autoConnect, status } = useHermesConnection();

  const hadSavedConfig = useRef(Boolean(loadHermesConfig()));
  const [sessionReady, setSessionReady] = useState(false);
  const [phase, setPhase] = useState<StartupPhase>(() =>
    hadSavedConfig.current ? "connecting" : "boot"
  );
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/local", { method: "POST" })
      .then((res) => setSessionReady(res.ok))
      .catch(() => setSessionReady(false));
  }, []);

  useEffect(() => {
    if (phase !== "boot") return;
    if (hadSavedConfig.current || isBusy) {
      setPhase("connecting");
    } else if (!isConnected && !isBusy) {
      setPhase("idle");
    }
  }, [isBusy, isConnected, phase]);

  useEffect(() => {
    if (isBusy && phase === "idle") {
      setPhase("connecting");
    }
  }, [isBusy, phase]);

  useEffect(() => {
    if (phase === "connecting" && !isBusy && !isConnected) {
      setPhase("idle");
    }
  }, [isBusy, isConnected, phase]);

  useEffect(() => {
    if (isConnected && sessionReady && phase === "connecting") {
      setPhase("leaving");
    }
  }, [isConnected, phase, sessionReady]);

  async function handleConnect() {
    setConnecting(true);
    setPhase("connecting");
    try {
      await autoConnect();
    } finally {
      setConnecting(false);
    }
  }

  const tip = troubleshootingTip(status.kind);
  const showOverlay = phase === "connecting" || phase === "leaving";

  if (showOverlay) {
    return (
      <GatewayConnectingOverlay
        leaving={phase === "leaving"}
        onExitComplete={() => router.push(redirectTo)}
      />
    );
  }

  return (
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
            Hermes Agent Desktop connects on startup.
          </p>
        </div>

        {status.error && (
          <div className="mb-4 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-left">
            {status.error}
            {tip && <div className="mt-1.5 text-text-muted">{tip}</div>}
          </div>
        )}

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
          Make sure Hermes Agent is running locally (`hermes gateway`).
        </p>
      </div>
    </div>
  );
}
