"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2, RefreshCw, Wrench, X } from "lucide-react";
import { connectionErrorExplanation } from "@/lib/hermes-setup-shared";

interface HermesConnectionErrorModalProps {
  open: boolean;
  onClose: () => void;
  error?: string;
  kind?: string;
  hasApiKey?: boolean | null;
  settingUp: boolean;
  restarting: boolean;
  actionMessage?: string | null;
  onEnableApiServer: () => void;
  onRestartGateway: () => void;
}

export function HermesConnectionErrorModal({
  open,
  onClose,
  error,
  kind,
  hasApiKey,
  settingUp,
  restarting,
  actionMessage,
  onEnableApiServer,
  onRestartGateway,
}: HermesConnectionErrorModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !settingUp && !restarting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open, restarting, settingUp]);

  if (!open) return null;

  const explanation = connectionErrorExplanation(kind, hasApiKey, error);
  const actionBusy = settingUp || restarting;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close connection error dialog"
        onClick={() => {
          if (!actionBusy) onClose();
        }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md card p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={actionBusy}
          className="absolute top-4 right-4 text-text-muted hover:text-text p-1 rounded-md disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4 pr-8">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Connection error</h2>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">{explanation}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {actionMessage && (
          <div className="mb-4 text-xs text-text-muted bg-bg-muted border border-border rounded-lg px-3 py-2">
            {actionMessage}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={onEnableApiServer}
            disabled={actionBusy}
            className="btn-primary w-full justify-center"
          >
            {settingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                Enable the API Server
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRestartGateway}
            disabled={actionBusy}
            className="btn-secondary w-full justify-center"
          >
            {restarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Restart Gateway
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}