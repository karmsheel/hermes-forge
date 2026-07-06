"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getProjectCardThumbStyle } from "@/lib/home/project-card-thumb";
import { setActiveProcessId } from "@/lib/workshop-storage";
import type { ProcessSummary } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function RecentProcessesStrip() {
  const router = useRouter();
  const { skin, resolved } = useTheme();
  const { currentBusiness } = useShell();
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [business, setBusiness] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/processes");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const list: ProcessSummary[] = data.processes || [];
      setProcesses(list.slice(0, 4));
      setBusiness(data.business || null);
    } catch {
      // silent — strip is non-critical
      setProcesses([]);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, currentBusiness?.id]);

  function selectProcess(processId: string) {
    if (!business) {
      router.push("/workshop");
      return;
    }
    setActiveProcessId(business.id, processId);
    router.push("/workshop");
  }

  if (loading) {
    return null;
  }

  if (processes.length === 0) {
    return null;
  }

  return (
    <div className="recent-projects">
      <div className="recent-projects__header">
        <div className="recent-projects__title">Recent processes</div>
        <Link href="/projects" className="recent-projects__view-all">
          View functions <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="recent-projects__grid">
        {processes.map((proc) => (
          <button
            key={proc.id}
            type="button"
            onClick={() => selectProcess(proc.id)}
            className="project-card"
            aria-label={`Open ${proc.name}`}
          >
            <div
              className="project-card__thumb"
              style={getProjectCardThumbStyle(proc.name, skin, resolved)}
            >
              <span className="project-card__initial">{proc.name[0]?.toUpperCase() || "P"}</span>
            </div>
            <div className="project-card__body">
              <div className="project-card__name" title={proc.name}>
                {proc.name}
              </div>
              <div className="project-card__meta">
                <span className="pill">{proc.department}</span>
                <span className="project-card__dot">·</span>
                <span className="project-card__time">{timeAgo(proc.updatedAt)}</span>
              </div>
              <div className="project-card__count">
                {proc._count?.messages ?? 0} message{(proc._count?.messages ?? 0) !== 1 ? "s" : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
