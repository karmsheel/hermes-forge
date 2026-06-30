"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { N8nConnectionPanel } from "./N8nConnectionPanel";

interface N8nConnectionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function N8nConnectionDialog({ open, onClose }: N8nConnectionDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close n8n connection dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        <N8nConnectionPanel />
      </div>
    </div>
  );
}