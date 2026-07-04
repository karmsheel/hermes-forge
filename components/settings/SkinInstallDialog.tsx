"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { FolderOpen, Loader2, Upload } from "lucide-react";
import { Button, Overlay, SegmentedControl } from "@/components/ui";
import { useTheme } from "@/components/theme/ThemeProvider";
import { isForgeDesktop, openVscodeThemeFile } from "@/lib/forge-desktop";
import { previewThemeFromText } from "@/lib/themes/install";
import { resolveSkinPalette } from "@/lib/themes/presets";

type InstallMode = "forge" | "vscode";

const FORGE_EXAMPLE = `{
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

const VSCODE_HINT = `// Paste a VS Code *-color-theme.json file
// (JSON with comments is supported)`;

interface SkinInstallDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SkinInstallDialog({ open, onClose }: SkinInstallDialogProps) {
  const { resolved, installSkin } = useTheme();
  const [mode, setMode] = useState<InstallMode>("forge");
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const desktop = isForgeDesktop();

  useEffect(() => {
    if (!open) return;
    setMode("forge");
    setJson("");
    setError(null);
    setInstalling(false);
  }, [open]);

  const preview = useMemo(() => previewThemeFromText(json), [json]);

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

  function handleFileText(text: string) {
    setJson(text);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      handleFileText(text);
    };
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsText(file);
  }

  async function handleDesktopBrowse() {
    setError(null);
    try {
      const text = await openVscodeThemeFile();
      if (text) {
        setMode("vscode");
        handleFileText(text);
      }
    } catch {
      setError("Could not open theme file.");
    }
  }

  const previewPalette = preview.ok ? resolveSkinPalette(preview.theme, resolved) : null;

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Install custom theme"
      description={
        mode === "vscode"
          ? "Paste or upload a VS Code color theme JSON file. Comments and trailing commas are supported."
          : "Paste or upload a Forge theme JSON file with background, foreground, and primary colors."
      }
      size="lg"
      closeDisabled={installing}
    >
      <SegmentedControl
        value={mode}
        onChange={setMode}
        ariaLabel="Theme format"
        className="mb-4"
        options={[
          { value: "forge", label: "Forge JSON" },
          { value: "vscode", label: "VS Code theme" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={handleFileChange}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={installing}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload .json
        </Button>
        {desktop && mode === "vscode" ? (
          <Button variant="secondary" size="sm" onClick={handleDesktopBrowse} disabled={installing}>
            <FolderOpen className="w-3.5 h-3.5" />
            Browse…
          </Button>
        ) : null}
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text underline-offset-2 hover:underline"
          onClick={() => {
            if (mode === "forge") {
              setJson(FORGE_EXAMPLE);
            } else {
              setJson("");
            }
            setError(null);
          }}
          disabled={installing}
        >
          {mode === "forge" ? "Load example" : "Clear"}
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
        placeholder={mode === "vscode" ? VSCODE_HINT : FORGE_EXAMPLE}
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
              {preview.ok
                ? `${preview.theme.name} · ${preview.source === "vscode" ? "VS Code" : "Forge"}`
                : ""}
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
        <Button variant="secondary" onClick={onClose} disabled={installing}>
          Cancel
        </Button>
        <Button onClick={handleInstall} disabled={installing || !preview.ok}>
          {installing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Installing…
            </>
          ) : (
            "Install theme"
          )}
        </Button>
      </div>
    </Overlay>
  );
}