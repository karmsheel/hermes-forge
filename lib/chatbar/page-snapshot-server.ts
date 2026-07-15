/**
 * Server-side page snapshot builder for hermes.forge.context.v1 (PR-3).
 * Summaries only — no API keys, no full diagram dumps.
 */

import { prisma } from "@/lib/prisma";
import { pageBlurbForPath } from "./page-registry";
import { clampSnapshotText, SNAPSHOT_MAX_CHARS } from "./context-protocol";
import { redactSecrets } from "./redaction";

export type PageSnapshotResult = {
  route: string;
  routeKey: string;
  pageTitle: string;
  text: string;
  approxChars: number;
  redactionCount: number;
};

function deptCounts(
  processes: { department: string | null }[],
): string {
  const map = new Map<string, number>();
  for (const p of processes) {
    const d = (p.department || "Unassigned").trim() || "Unassigned";
    map.set(d, (map.get(d) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([d, n]) => `${d}: ${n}`)
    .join("; ");
}

/**
 * Build a read-only snapshot for the active business + route.
 */
export async function buildServerPageSnapshot(options: {
  businessId: string;
  businessName: string;
  route: string;
}): Promise<PageSnapshotResult> {
  const route = options.route || "/home";
  const blurb = pageBlurbForPath(route);
  const lines: string[] = [
    `Business: ${options.businessName}`,
    `Page: ${blurb.title}`,
  ];

  // Settings: purpose only — never keys
  if (blurb.routeKey === "settings" || blurb.routeKey === "profile") {
    lines.push("Snapshot: page help only (no connection secrets).");
    const joined = lines.join("\n");
    const redacted = redactSecrets(joined);
    const clamped = clampSnapshotText(redacted.text, SNAPSHOT_MAX_CHARS);
    return {
      route,
      routeKey: blurb.routeKey,
      pageTitle: blurb.title,
      text: clamped.text,
      approxChars: clamped.approxChars,
      redactionCount: redacted.redactionCount,
    };
  }

  const processes = await prisma.process.findMany({
    where: { businessId: options.businessId },
    select: {
      id: true,
      name: true,
      department: true,
      status: true,
      updatedAt: true,
      automationScore: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  lines.push(`Process count: ${processes.length}`);
  if (processes.length) {
    const depts = deptCounts(processes);
    if (depts) lines.push(`Departments: ${depts}`);
  }

  switch (blurb.routeKey) {
    case "home": {
      const recent = processes.slice(0, 6);
      if (recent.length) {
        lines.push("Recent processes:");
        for (const p of recent) {
          lines.push(`- ${p.name} [${p.status}] (${p.department || "—"})`);
        }
      } else {
        lines.push("Recent processes: none yet — user can start from a brief.");
      }
      lines.push("Hint: Home composer creates a process and seeds workshop chat.");
      break;
    }
    case "functions": {
      lines.push("Functions view: org chart + analytics from process departments.");
      const byStatus = new Map<string, number>();
      for (const p of processes) {
        byStatus.set(p.status, (byStatus.get(p.status) || 0) + 1);
      }
      if (byStatus.size) {
        lines.push(
          `Status mix: ${[...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`,
        );
      }
      break;
    }
    case "personnel": {
      const [humans, agents] = await Promise.all([
        prisma.humanPersonnel.count({ where: { businessId: options.businessId } }),
        prisma.hermesAgentProfile.count({ where: { businessId: options.businessId } }),
      ]);
      lines.push(`Humans on roster: ${humans}`);
      lines.push(`Hermes agent profiles: ${agents}`);
      const sample = await prisma.humanPersonnel.findMany({
        where: { businessId: options.businessId },
        select: { name: true, role: true, isOwner: true },
        orderBy: [{ isOwner: "desc" }, { createdAt: "desc" }],
        take: 8,
      });
      if (sample.length) {
        lines.push("Roster sample:");
        for (const h of sample) {
          lines.push(
            `- ${h.name} — ${h.role}${h.isOwner ? " (owner)" : ""}`,
          );
        }
      }
      break;
    }
    case "documents": {
      const docs = await prisma.businessDocument.findMany({
        where: { businessId: options.businessId },
        select: {
          title: true,
          kind: true,
          slug: true,
          pinnedForContext: true,
          bodyMarkdown: true,
          updatedAt: true,
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        take: 24,
      });
      lines.push(`Knowledge documents: ${docs.length}`);
      if (docs.length === 0) {
        lines.push("No documents yet — seeds appear when the Documents page is opened.");
      } else {
        lines.push("Document index:");
        for (const d of docs) {
          const pin = d.pinnedForContext ? " [pinned]" : "";
          lines.push(`- ${d.title} (${d.kind}/${d.slug})${pin}`);
        }
        const pinned = docs.filter((d) => d.pinnedForContext || d.slug === "basics");
        if (pinned.length) {
          lines.push("Pinned / basics previews (truncated):");
          for (const d of pinned.slice(0, 4)) {
            const preview = d.bodyMarkdown
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 280);
            lines.push(`--- ${d.title} ---`);
            lines.push(preview || "(empty)");
          }
        }
      }
      lines.push(
        "Hint: User can edit markdown in Documents; ask to draft sections they can paste or save.",
      );
      break;
    }
    case "workshop": {
      lines.push(
        "Workshop: process mapping surface. Studio chat is co-pilot; process chat column still maps diagrams.",
      );
      if (processes.length) {
        lines.push("Processes available:");
        for (const p of processes.slice(0, 10)) {
          lines.push(`- ${p.name} [${p.status}] id=${p.id}`);
        }
      } else {
        lines.push("No processes yet.");
      }
      break;
    }
    case "automation-studio": {
      const processId = route.match(/^\/automations\/([^/?#]+)/)?.[1];
      if (processId) {
        const auto = await prisma.automation.findUnique({
          where: { processId },
          select: {
            status: true,
            type: true,
            externalId: true,
            planJson: true,
            hermesAgentProfile: { select: { displayName: true } },
            process: {
              select: {
                name: true,
                department: true,
                status: true,
                trigger: true,
              },
            },
          },
        });
        if (auto?.process) {
          lines.push(`Studio process: ${auto.process.name} [${auto.process.status}]`);
          lines.push(`Department: ${auto.process.department || "—"}`);
          lines.push(`Automation status: ${auto.status}`);
          if (auto.type) lines.push(`Runtime type: ${auto.type}`);
          if (auto.externalId) lines.push("Deployed: yes (external job linked)");
          else lines.push("Deployed: not yet");
          if (auto.hermesAgentProfile) {
            lines.push(`Assigned agent: ${auto.hermesAgentProfile.displayName}`);
          } else {
            lines.push("Assigned agent: none — recommend hiring/assigning before cron deploy");
          }
          if (auto.planJson) {
            const preview = auto.planJson.replace(/\s+/g, " ").trim().slice(0, 400);
            lines.push(`Plan draft (truncated): ${preview}`);
          } else {
            lines.push("Plan draft: empty — design in this chat toward Ready to deploy");
          }
        } else {
          lines.push(`Automation studio process id=${processId} (loading or not found)`);
        }
      }
      lines.push(
        "Hint: This dock is the automation design chat. Deploy from the left panel when ready.",
      );
      break;
    }
    case "automations": {
      const approved = processes.filter(
        (p) =>
          p.status === "approved" ||
          p.status === "forged" ||
          p.status === "ready_for_automation",
      );
      lines.push(`Candidates (approved-ish): ${approved.length}`);
      for (const p of approved.slice(0, 8)) {
        lines.push(
          `- ${p.name} score=${p.automationScore ?? "—"} [${p.status}]`,
        );
      }
      break;
    }
    case "log": {
      const events = await prisma.businessEvent.findMany({
        where: { businessId: options.businessId },
        select: { type: true, summary: true, recordedAt: true },
        orderBy: { recordedAt: "desc" },
        take: 12,
      });
      lines.push(`Recent events (summaries only): ${events.length}`);
      for (const e of events) {
        const when = e.recordedAt.toISOString().slice(0, 16);
        lines.push(`- [${when}] ${e.type}: ${e.summary}`);
      }
      break;
    }
    case "business-manager": {
      const count = await prisma.business.count({
        where: {
          // same user as this business
          userId: (
            await prisma.business.findUnique({
              where: { id: options.businessId },
              select: { userId: true },
            })
          )?.userId,
        },
      });
      lines.push(`User business count: ${count || 1}`);
      lines.push(`Active business: ${options.businessName}`);
      break;
    }
    default: {
      if (processes.length) {
        lines.push("Process names:");
        for (const p of processes.slice(0, 8)) {
          lines.push(`- ${p.name}`);
        }
      }
      break;
    }
  }

  const joined = lines.join("\n");
  const redacted = redactSecrets(joined);
  const clamped = clampSnapshotText(redacted.text, SNAPSHOT_MAX_CHARS);

  return {
    route,
    routeKey: blurb.routeKey,
    pageTitle: blurb.title,
    text: clamped.text,
    approxChars: clamped.approxChars,
    redactionCount: redacted.redactionCount,
  };
}
