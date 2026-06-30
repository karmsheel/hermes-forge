"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { clearLegacyActiveProcessId } from "@/lib/workshop-storage";
import type { BusinessSummary } from "@/lib/types";

interface ProjectWithStatus extends BusinessSummary {
  statusLabel: string;
  statusClass: string;
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function hashToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h % 360);
}

function getThumbStyle(name: string): React.CSSProperties {
  const hue = hashToHue(name);
  const hue2 = (hue + 42) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 42%, 40%), hsl(${hue2}, 38%, 32%))`,
  };
}

function getStatus(project: BusinessSummary): { label: string; className: string } {
  const count = project._count?.processes ?? 0;
  if (count === 0) {
    return { label: "Not started", className: "pill" };
  }
  const updated = new Date(project.updatedAt).getTime();
  const hours = (Date.now() - updated) / (1000 * 60 * 60);
  if (hours < 24) {
    return { label: "Mapping", className: "pill pill-accent" };
  }
  return { label: "Needs input", className: "pill pill-amber" };
}

export function RecentProjectsStrip() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/businesses");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const list: BusinessSummary[] = data.businesses || [];
      const top = list.slice(0, 4).map((p) => {
        const s = getStatus(p);
        return { ...p, statusLabel: s.label, statusClass: s.className } as ProjectWithStatus;
      });
      setProjects(top);
    } catch {
      // silent — strip is non-critical
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function selectProject(id: string) {
    try {
      const res = await fetch("/api/businesses/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (!res.ok) throw new Error("Failed");
      clearLegacyActiveProcessId();
      router.push("/workshop");
    } catch {
      toast.error("Could not open project");
    }
  }

  if (loading) {
    return null;
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="recent-projects">
      <div className="recent-projects__header">
        <div className="recent-projects__title">Recent projects</div>
        <Link href="/projects" className="recent-projects__view-all">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="recent-projects__grid">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => selectProject(project.id)}
            className="project-card"
            aria-label={`Open ${project.name}`}
          >
            <div className="project-card__thumb" style={getThumbStyle(project.name)}>
              <span className="project-card__initial">{project.name[0]?.toUpperCase() || "P"}</span>
            </div>
            <div className="project-card__body">
              <div className="project-card__name" title={project.name}>
                {project.name}
              </div>
              <div className="project-card__meta">
                <span className={project.statusClass}>{project.statusLabel}</span>
                <span className="project-card__dot">·</span>
                <span className="project-card__time">{timeAgo(project.updatedAt)}</span>
              </div>
              <div className="project-card__count">
                {project._count?.processes ?? 0} workflow{(project._count?.processes ?? 0) !== 1 ? "s" : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
