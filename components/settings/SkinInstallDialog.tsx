"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { resolveSkinPalette } from "@/lib/themes/presets";
import { parseThemeInput } from "@/lib/themes/validate";

const EXAMPLE_THEME = `{
  "name": "ocean-glow",
  "label": "Ocean Glow",
  "description": "Cool blues on warm neutrals",
  "colors": {
    "background": "#f8faff",
    "foreground": "#17171a",
    "primary": "#0053fd"
  },
  "darkColors": {
    "background": "#0d1117",
    "foreground": "#e8edf5",
    "primary": "#6b8fe8"
  }
}`;

interface SkinInstallDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SkinInstallDialog({ open, onClose }: SkinInstallDialogProps) {
  const { resolved, installSkin } = useTheme();
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setJson("");
    setError(null);
    setInstalling(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !installing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, installing, onClose]);

  const preview = useMemo(() => parseThemeInput(json), [json]);

  async function handleInstall() {
    setError(null);
    setInstalling(true);
    try {
      installSkin(json);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install theme.");
    } finally {
      setInstalling(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJson(text);
      setError(null);
    };
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsText(file);
  }

  if (!open) return null;

  const previewPalette =
    preview.ok ? resolveSkinPalette(preview.theme, resolved) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close install theme dialog"
        onClick={installing ? undefined : onClose}
        disabled={installing}
      />
      <div className="relative w-full max-w-lg card p-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={installing}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-xl font-semibold tracking-tight">Install custom theme</h2>
          <p className="text-sm text-text-muted mt-1">
            Paste or upload a JSON theme file. Requires{" "}
            <code className="text-xs">background</code>, <code className="text-xs">foreground</code>
            , and <code className="text-xs">primary</code> in{" "}
            <code className="text-xs">colors</code> (optional <code className="text-xs">darkColors</code>
            ).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={installing}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload .json
          </button>
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text underline-offset-2 hover:underline"
            onClick={() => {
              setJson(EXAMPLE_THEME);
              setError(null);
            }}
            disabled={installing}
          >
            Load example
          </button>
        </div>

        <label htmlFor="skin-json" className="sr-only">
          Theme JSON
        </label>
        <textarea
          id="skin-json"
          className="input w-full text-xs font-mono min-h-[180px] resize-y leading-relaxed"
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setError(null);
          }}
          placeholder={EXAMPLE_THEME}
          spellCheck={false}
          disabled={installing}
        />

        {previewPalette && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-border-soft bg-bg-subtle px-3 py-2">
            <span
              className="settings-menu__skin-swatch"
              style={
                {
                  "--skin-bg": previewPalette.background,
                  "--skin-primary": previewPalette.primary,
                } as CSSProperties
              }
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-strong truncate">
                {preview.ok ? preview.theme.label : "Preview"}
              </p>
              <p className="text-xs text-text-muted truncate">
                {preview.ok ? preview.theme.name : ""}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red" role="alert">
            {error}
          </p>
        )}

        {!error && json.trim() && !preview.ok && (
          <p className="mt-3 text-sm text-amber" role="status">
            {preview.error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={installing}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing || !preview.ok}
            className="btn-primary text-sm disabled:opacity-50 inline-flex items-center gap-2"
          >
            {installing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Installing…
              </>
            ) : (
              "Install theme"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}