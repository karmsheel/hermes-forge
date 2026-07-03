/**
 * Formatters for the Cronalytics page.
 * Mirrors the helpers in dashboard/src/lib/formatters.js (original plugin).
 */

export function fmtCost(n: number | null | undefined, currency = "$"): string {
  if (n == null || !Number.isFinite(n)) return `${currency}0.00`;
  if (Math.abs(n) < 0.01) return `${currency}${n.toFixed(4)}`;
  if (Math.abs(n) < 1) return `${currency}${n.toFixed(3)}`;
  if (Math.abs(n) < 100) return `${currency}${n.toFixed(2)}`;
  return `${currency}${n.toFixed(0)}`;
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtTokens(n: number | null | undefined): string {
  return fmtCompact(n);
}

export function fmtTime(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null) return "—";
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function fmtSyncAge(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const ageSec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
  return `${Math.floor(ageSec / 86400)}d ago`;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function paceColor(status: string): string {
  switch (status) {
    case "on_track":
      return "text-emerald-400";
    case "drifting":
      return "text-amber-400";
    case "stuck":
      return "text-rose-400";
    case "no_schedule":
    case "no_runs":
    default:
      return "text-text-muted";
  }
}

export function paceLabel(status: string): string {
  switch (status) {
    case "on_track":
      return "On track";
    case "drifting":
      return "Drifting";
    case "stuck":
      return "Stuck";
    case "no_schedule":
      return "No schedule";
    case "no_runs":
    default:
      return "No runs yet";
  }
}
