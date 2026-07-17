"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileImage, FileType, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadPlantExport,
  type PlantExportFormat,
  type PlantExportInput,
} from "@/lib/export-plant";

interface PlantExportMenuProps {
  input: PlantExportInput | null;
  disabled?: boolean;
  className?: string;
}

const FORMATS: {
  format: PlantExportFormat;
  label: string;
  hint: string;
  icon: typeof FileImage;
}[] = [
  {
    format: "png",
    label: "PNG image",
    hint: "Theme colors · 2× resolution",
    icon: FileImage,
  },
  {
    format: "svg",
    label: "SVG vector",
    hint: "Editable in design tools",
    icon: FileType,
  },
  {
    format: "pdf",
    label: "PDF document",
    hint: "Print-friendly white paper",
    icon: FileType,
  },
];

/**
 * Map / Foundation toolbar control: export the business plant as PNG, SVG, or PDF.
 */
export function PlantExportMenu({
  input,
  disabled = false,
  className = "",
}: PlantExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<PlantExportFormat | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canExport = Boolean(input && input.blocks.length > 0) && !disabled;

  async function run(format: PlantExportFormat) {
    if (!input || input.blocks.length === 0) {
      toast.error("No processes to export yet");
      return;
    }
    setExporting(format);
    try {
      await downloadPlantExport(format, input);
      toast.success(
        format === "png"
          ? "Plant PNG downloaded"
          : format === "svg"
            ? "Plant SVG downloaded"
            : "Plant PDF downloaded",
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plant export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!canExport || exporting !== null}
        className="p-2 rounded-lg border border-border-strong bg-bg-panel hover:bg-bg-muted text-text disabled:opacity-40 transition-colors flex items-center gap-1.5 text-xs px-3"
        title={
          canExport
            ? "Export plant (PNG, SVG, PDF)"
            : "Add processes to export the plant"
        }
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {exporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {exporting ? "Exporting…" : "Export"}
      </button>

      {open && canExport ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-1.5 z-40 min-w-[12.5rem] rounded-lg border border-border bg-bg-elevated shadow-lg py-1"
        >
          {FORMATS.map(({ format, label, hint, icon: Icon }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled={exporting !== null}
              onClick={() => void run(format)}
              className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-bg-subtle disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5 mt-0.5 text-text-muted shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-text">{label}</span>
                <span className="block text-[10px] text-text-faint">{hint}</span>
              </span>
              {exporting === format ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted ml-auto mt-0.5" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
