"use client";

import Link from "next/link";
import {
  FileText,
  GitBranch,
  Home,
  Layers,
} from "lucide-react";
import type {
  FoundationDocumentSummary,
  FoundationProcessCard,
} from "@/lib/foundation";
import { PROCESS_STATUS_LABELS } from "@/lib/process-status";
import { IoShapeGlyph } from "@/components/process/IoShapeGlyph";
import { getIoShapeMeta } from "@/lib/io-shape";

interface FoundationSidebarProps {
  businessName: string | null;
  businessDescription: string | null;
  processes: FoundationProcessCard[];
  documents: FoundationDocumentSummary[];
  showDocuments: boolean;
  showProcesses: boolean;
  selectedProcessId: string | null;
  onSelectProcess: (id: string) => void;
}

export function FoundationSidebar({
  businessName,
  businessDescription,
  processes,
  documents,
  showDocuments,
  showProcesses,
  selectedProcessId,
  onSelectProcess,
}: FoundationSidebarProps) {
  return (
    <aside className="w-full sm:w-64 shrink-0 border-r border-border bg-bg-panel flex flex-col min-h-0">
      <div className="px-4 py-4 border-b border-border">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
          Foundation
        </div>
        <div className="font-semibold text-sm text-text-strong truncate" title={businessName ?? undefined}>
          {businessName || "No business"}
        </div>
        {businessDescription ? (
          <p className="text-[11px] text-text-muted mt-1 line-clamp-3">
            {businessDescription}
          </p>
        ) : (
          <p className="text-[11px] text-text-faint mt-1 italic">
            Describe the business in chat to fill Documents.
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted px-1 mb-1.5">
            <Home className="w-3 h-3" />
            Entry
          </div>
          <Link
            href="/home"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-text-muted hover:bg-bg-subtle hover:text-text"
          >
            Home composer
          </Link>
        </div>

        {showDocuments ? (
          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted">
                <FileText className="w-3 h-3" />
                Documents
              </div>
              <Link
                href="/documents"
                className="text-[10px] text-accent hover:underline"
              >
                Open
              </Link>
            </div>
            <ul className="space-y-0.5">
              {documents.slice(0, 8).map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents?doc=${encodeURIComponent(doc.slug)}`}
                    className="block px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:bg-bg-subtle hover:text-text truncate"
                    title={doc.title}
                  >
                    {doc.title}
                    {doc.pinnedForContext ? (
                      <span className="text-text-faint"> · pinned</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {documents.length === 0 ? (
              <p className="px-2.5 text-[11px] text-text-faint">
                Knowledge docs appear as you capture basics.
              </p>
            ) : null}
          </div>
        ) : null}

        {showProcesses ? (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted px-1 mb-1.5">
              <Layers className="w-3 h-3" />
              Processes
              <span className="text-text-faint normal-case tracking-normal">
                ({processes.length})
              </span>
            </div>
            {processes.length === 0 ? (
              <p className="px-2.5 text-[11px] text-text-faint">
                No drafts yet — add a block or talk with Hermes.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {processes.map((proc) => {
                  const active = proc.id === selectedProcessId;
                  const statusLabel =
                    PROCESS_STATUS_LABELS[
                      proc.status as keyof typeof PROCESS_STATUS_LABELS
                    ] ?? proc.status;
                  return (
                    <li key={proc.id}>
                      <button
                        type="button"
                        onClick={() => onSelectProcess(proc.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${
                          active
                            ? "bg-bg-muted border border-border-strong"
                            : "hover:bg-bg-subtle border border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <IoShapeGlyph
                            shape={proc.ioShape}
                            size="sm"
                            className="text-text-muted mt-0.5 shrink-0"
                            title={false}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {proc.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted">
                              <span className="truncate">{proc.department}</span>
                              <span className="text-text-faint">·</span>
                              <span>{statusLabel}</span>
                              {proc.hasDiagram ? (
                                <>
                                  <span className="text-text-faint">·</span>
                                  <GitBranch className="w-3 h-3 text-green shrink-0" />
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div className="px-1 pt-2 border-t border-border">
          <p className="text-[10px] text-text-faint leading-relaxed">
            Shape key:{" "}
            {(["siso", "simo", "miso", "mimo"] as const).map((id, i) => (
              <span key={id}>
                {i > 0 ? " · " : ""}
                <span title={getIoShapeMeta(id).label}>{id}</span>
              </span>
            ))}
          </p>
        </div>
      </nav>
    </aside>
  );
}
