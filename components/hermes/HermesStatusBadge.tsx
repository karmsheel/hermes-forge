"use client";

import { Loader2, PlugZap } from "lucide-react";
import { useHermesConnection } from "./HermesConnectionProvider";

interface HermesStatusBadgeProps {
  onClick?: () => void;
}

export function HermesStatusBadge({ onClick }: HermesStatusBadgeProps) {
  const { isConnected, isBusy, status, autoConnect } = useHermesConnection();

  const label = isBusy
    ? "Connecting..."
    : isConnected
      ? "Hermes connected"
      : "Connect Hermes";

  const content = (
    <>
      {isBusy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400" : "bg-amber-400"
          } ${isConnected ? "animate-pulse" : ""}`}
        />
      )}
      <PlugZap className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
      {isConnected && status.latencyMs != null && (
        <span className="hidden md:inline text-zinc-500">{status.latencyMs}ms</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 transition-colors disabled:opacity-60"
        title={status.error || label}
      >
        {content}
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => void autoConnect()}
        disabled={isBusy}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 transition-colors disabled:opacity-60"
        title={status.error || label}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      title={`${status.model ?? "Hermes"} · ${status.latencyMs ?? "?"}ms`}
    >
      {content}
    </div>
  );
}