"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !closeDisabled) onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeDisabled, onClose]);

  if (!open || !mounted) return null;

  const widthClass =
    size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-lg";

  const zClass = elevated ? "z-[80]" : "z-[60]";

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 ${zClass}`}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
        onClick={closeDisabled ? undefined : onClose}
      />
      <div
        className={`overlay-panel relative z-10 w-full ${widthClass} p-6 max-h-[90vh] overflow-y-auto text-text`}
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
    </div>,
    document.body
  );
}