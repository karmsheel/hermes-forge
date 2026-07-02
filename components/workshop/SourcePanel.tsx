"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface SourcePanelProps {
  chart: string;
}

export function SourcePanel({ chart }: SourcePanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might not be available
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-2 border-b border-border shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">Mermaid Source</span>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary text-xs py-1 px-2 flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-5 text-[11px] font-mono text-text-muted leading-relaxed">
        {chart}
      </pre>
    </div>
  );
}
