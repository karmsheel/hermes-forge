"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, GitBranch } from "lucide-react";
import {
  getProcessStandard,
  PROCESS_STANDARDS,
  storeProcessStandard,
  type ProcessStandardId,
} from "@/lib/process-standards";

interface ProcessStandardPickerProps {
  value: ProcessStandardId;
  onChange: (id: ProcessStandardId) => void;
}

export function ProcessStandardPicker({ value, onChange }: ProcessStandardPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = getProcessStandard(value);

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

  function handleSelect(id: ProcessStandardId) {
    onChange(id);
    storeProcessStandard(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="home-standard-picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="home-standard-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Process standard: ${selected.label}`}
      >
        <GitBranch className="w-3 h-3 shrink-0 text-text-soft" aria-hidden />
        <span className="home-standard-picker__prefix">Standard</span>
        <span className="home-standard-picker__value">{selected.label}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-text-soft transition-transform${open ? " rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="home-standard-picker__menu" role="listbox" aria-label="Process standard">
          {PROCESS_STANDARDS.map((standard) => {
            const active = value === standard.id;
            return (
              <li key={standard.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`home-standard-picker__option${active ? " is-active" : ""}`}
                  onClick={() => handleSelect(standard.id)}
                >
                  <span className="home-standard-picker__option-title">{standard.label}</span>
                  <span className="home-standard-picker__option-desc">{standard.shortDescription}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}