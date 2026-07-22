"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ClipboardCopy, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import type { PromptCatalogMeta, PromptPackId } from "@/lib/chatbar/prompt-catalog";

type PreviewState = {
  packId: string;
  route: string;
  businessName: string;
  system: string;
  pageContext: string | null;
  redactionCount: number;
  disclaimer: string;
};

const SURFACE_ORDER = ["chatbar", "background", "job"] as const;
const SURFACE_LABEL: Record<(typeof SURFACE_ORDER)[number], string> = {
  chatbar: "Chatbar",
  background: "Background agents",
  job: "Jobs / deploy",
};

export function SettingsAgentPrompts() {
  const [packs, setPacks] = useState<PromptCatalogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewByPack, setPreviewByPack] = useState<
    Record<string, PreviewState | "loading" | "error">
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings/prompt-catalog");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load catalog");
        }
        const data = await res.json();
        if (!cancelled) {
          setPacks(Array.isArray(data.packs) ? data.packs : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    return SURFACE_ORDER.map((surface) => ({
      surface,
      label: SURFACE_LABEL[surface],
      packs: packs.filter((p) => p.surface === surface),
    })).filter((g) => g.packs.length > 0);
  }, [packs]);

  const loadPreview = useCallback(async (packId: PromptPackId) => {
    setPreviewByPack((prev) => ({ ...prev, [packId]: "loading" }));
    try {
      const res = await fetch(
        `/api/settings/prompt-preview?pack=${encodeURIComponent(packId)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Preview failed");
      }
      const data = (await res.json()) as PreviewState;
      setPreviewByPack((prev) => ({ ...prev, [packId]: data }));
    } catch {
      setPreviewByPack((prev) => ({ ...prev, [packId]: "error" }));
      toast.error("Could not build prompt preview");
    }
  }, []);

  const toggleExpand = useCallback(
    (packId: PromptPackId) => {
      setExpandedId((cur) => {
        const next = cur === packId ? null : packId;
        if (next && previewByPack[packId] === undefined) {
          void loadPreview(packId);
        }
        return next;
      });
    },
    [loadPreview, previewByPack],
  );

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied");
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
          <ScrollText className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Agent prompts</h2>
          <p className="text-xs text-text-soft">
            System prompts Forge injects by surface. Same builders as live chat.
          </p>
        </div>
      </div>

      <div className="card p-4 sm:p-6 space-y-4">
        <p className="text-xs text-text-muted leading-relaxed">
          Live previews use your active business name when available, with sample
          process fields. They do not include every runtime injection (full diagram,
          documents, streaming tools). Secrets are redacted.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog…
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-danger py-4" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error
          ? grouped.map((group) => (
              <div key={group.surface} className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                  {group.label}
                </h3>
                <ul className="divide-y divide-border-soft border border-border rounded-lg overflow-hidden">
                  {group.packs.map((pack) => {
                    const open = expandedId === pack.id;
                    const preview = previewByPack[pack.id];
                    return (
                      <li key={pack.id} className="bg-bg-elevated">
                        <button
                          type="button"
                          className="w-full flex items-start gap-2 px-3 py-3 text-left hover:bg-bg-subtle transition-colors"
                          onClick={() => toggleExpand(pack.id as PromptPackId)}
                          aria-expanded={open}
                        >
                          <ChevronDown
                            className={`w-4 h-4 mt-0.5 shrink-0 text-text-muted transition-transform ${
                              open ? "rotate-0" : "-rotate-90"
                            }`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-text-strong">
                              {pack.title}
                            </div>
                            <div className="text-[11px] text-text-soft font-mono mt-0.5">
                              {pack.id}
                            </div>
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                              {pack.description}
                            </p>
                            {pack.routes.length > 0 ? (
                              <p className="text-[10px] text-text-soft mt-1">
                                Routes: {pack.routes.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </button>

                        {open ? (
                          <div className="px-3 pb-3 pl-9 space-y-3 border-t border-border-soft bg-bg">
                            {preview === "loading" || preview === undefined ? (
                              <div className="flex items-center gap-2 text-xs text-text-muted py-3">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building
                                preview…
                              </div>
                            ) : null}
                            {preview === "error" ? (
                              <div className="flex items-center gap-2 py-2">
                                <p className="text-xs text-danger">Preview failed.</p>
                                <button
                                  type="button"
                                  className="text-xs text-accent hover:underline"
                                  onClick={() =>
                                    void loadPreview(pack.id as PromptPackId)
                                  }
                                >
                                  Retry
                                </button>
                              </div>
                            ) : null}
                            {preview &&
                            preview !== "loading" &&
                            preview !== "error" ? (
                              <>
                                <p className="text-[10px] text-text-soft pt-2">
                                  Business · {preview.businessName} · route{" "}
                                  <code className="font-mono">{preview.route}</code>
                                  {preview.redactionCount > 0
                                    ? ` · ${preview.redactionCount} redaction(s)`
                                    : ""}
                                </p>
                                <PromptBlock
                                  title="System prompt"
                                  text={preview.system}
                                  copyKey={`${pack.id}-system`}
                                  copiedKey={copiedKey}
                                  onCopy={copyText}
                                />
                                {preview.pageContext ? (
                                  <PromptBlock
                                    title="Page context message"
                                    text={preview.pageContext}
                                    copyKey={`${pack.id}-page`}
                                    copiedKey={copiedKey}
                                    onCopy={copyText}
                                  />
                                ) : (
                                  <p className="text-[11px] text-text-soft">
                                    No separate page-context message for this pack.
                                  </p>
                                )}
                                <p className="text-[10px] text-text-soft leading-relaxed">
                                  {preview.disclaimer}
                                </p>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}

function PromptBlock({
  title,
  text,
  copyKey,
  copiedKey,
  onCopy,
}: {
  title: string;
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  const copied = copiedKey === copyKey;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
          {title}
        </h4>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text px-1.5 py-0.5 rounded border border-border"
          onClick={() => onCopy(copyKey, text)}
        >
          {copied ? (
            <Check className="w-3 h-3" aria-hidden />
          ) : (
            <ClipboardCopy className="w-3 h-3" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto rounded-md border border-border bg-bg-muted p-3 font-mono text-text">
        {text}
      </pre>
    </div>
  );
}
