"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Loader2 } from "lucide-react";
import { useHermesConnection } from "./HermesConnectionProvider";
import { formatModelLabel } from "@/lib/hermes-models";

interface HermesModelSwitcherProps {
  className?: string;
  onOpenConnection?: () => void;
}

export function HermesModelSwitcher({
  className = "",
  onOpenConnection,
}: HermesModelSwitcherProps) {
  const {
    isConnected,
    isBusy,
    modelsLoading,
    availableModels,
    selectedModel,
    setModel,
    status,
  } = useHermesConnection();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const label =
    selectedModel != null
      ? formatModelLabel(selectedModel)
      : status.model
        ? formatModelLabel(status.model)
        : "Model";

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={onOpenConnection}
        disabled={isBusy}
        className={`hermes-model-switcher hermes-model-switcher--disconnected ${className}`}
        title="Connect Hermes to choose a model"
      >
        <Bot className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        <span className="hermes-model-switcher__label">Model</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-text-soft" />
      </button>
    );
  }

  const options =
    availableModels.length > 0
      ? availableModels
      : selectedModel
        ? [{ id: selectedModel, label: formatModelLabel(selectedModel) }]
        : status.model
          ? [{ id: status.model, label: formatModelLabel(status.model) }]
          : [];

  return (
    <div className={`hermes-model-switcher ${className}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="hermes-model-switcher__trigger"
        onClick={() => setOpen((value) => !value)}
        disabled={isBusy || modelsLoading || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch Hermes model"
      >
        {modelsLoading ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-text-muted" />
        ) : (
          <Bot className="w-3.5 h-3.5 shrink-0 text-accent" />
        )}
        <span className="hermes-model-switcher__label">{label}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-text-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && options.length > 0 && (
        <div className="hermes-model-switcher__menu" role="listbox" aria-label="Hermes models">
          {options.map((option) => {
            const active = option.id === selectedModel;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`hermes-model-switcher__option${active ? " is-active" : ""}`}
                onClick={() => {
                  setModel(option.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}