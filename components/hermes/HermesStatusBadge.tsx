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
            isConnected ? "bg-green" : "bg-amber"
          } ${isConnected ? "animate-pulse" : ""}`}
        />
      )}
      <PlugZap className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
      {isConnected && status.latencyMs != null && (
        <span className="hidden md:inline text-text-muted">{status.latencyMs}ms</span>
      )}
    </>
  );

  const baseClass =
    "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-60";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy}
        className={`${baseClass} border-border hover:border-border-strong hover:bg-bg-subtle`}
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
        className={`${baseClass} border-border hover:border-border-strong hover:bg-bg-subtle`}
        title={status.error || label}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`${baseClass} border-green-border bg-green-bg text-green`}
      title={`${status.model ?? "Hermes"} · ${status.latencyMs ?? "?"}ms`}
    >
      {content}
    </div>
  );
}