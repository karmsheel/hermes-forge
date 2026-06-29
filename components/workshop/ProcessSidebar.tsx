"use client";

import { Plus, GitBranch, Loader2 } from "lucide-react";
import type { ProcessSummary } from "@/lib/types";

interface ProcessSidebarProps {
  processes: ProcessSummary[];
  activeId: string | null;
  businessName: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ProcessSidebar({
  processes,
  activeId,
  businessName,
  loading,
  creating,
  onSelect,
  onCreate,
}: ProcessSidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <span className="text-black font-bold text-sm">H</span>
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight">Hermes Forge</div>
            <div className="text-[10px] text-zinc-500">Process Workshop</div>
          </div>
        </div>
        {businessName && (
          <div className="text-[10px] text-zinc-500 mt-2 truncate">{businessName}</div>
        )}
      </div>

      <div className="p-3">
        <button
          onClick={onCreate}
          disabled={creating}
          className="btn-primary w-full justify-center text-sm py-2"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Process
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 px-2 mb-2">
          Processes
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
          </div>
        ) : processes.length === 0 ? (
          <div className="text-xs text-zinc-500 px-2 py-4 text-center">
            No processes yet. Create one to start mapping.
          </div>
        ) : (
          <ul className="space-y-1">
            {processes.map((proc) => {
              const isActive = proc.id === activeId;
              const hasDiagram = !!proc.diagramMermaid;

              return (
                <li key={proc.id}>
                  <button
                    onClick={() => onSelect(proc.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      isActive
                        ? "bg-zinc-800 border border-zinc-700"
                        : "hover:bg-zinc-900 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GitBranch
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          hasDiagram ? "text-emerald-400" : "text-zinc-600"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{proc.name}</div>
                        {proc.description && (
                          <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {proc.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-px rounded bg-zinc-800 text-zinc-400">
                            {proc.department}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {proc._count.messages} msgs
                          </span>
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
    </aside>
  );
}