"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeDisabled = false,
  elevated = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  closeDisabled?: boolean;
  elevated?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !closeDisabled) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  const widthClass =
    size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-lg";

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4${elevated ? " z-[80]" : " z-[60]"}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label={`Close ${title}`}
        onClick={closeDisabled ? undefined : onClose}
        disabled={closeDisabled}
      />
      <div
        className={`overlay-panel relative w-full ${widthClass} p-6 max-h-[90vh] overflow-y-auto text-text`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          disabled={closeDisabled}
          className="absolute top-4 right-4"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </Button>

        <div className="mb-5 pr-8">
          <h2 id="overlay-title" className="text-xl font-semibold tracking-tight text-text-strong">
            {title}
          </h2>
          {description ? <p className="text-sm text-text-muted mt-1">{description}</p> : null}
        </div>

        {children}
      </div>
    </div>
  );
}