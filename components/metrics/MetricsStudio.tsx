"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  emptyContentHealth,
  type ContentHealthCounts,
  type ContentStatus,
} from "@/lib/content-types";
import {
  METRIC_CHANNEL_LABELS,
  METRIC_CHANNELS,
  METRIC_COLLECTION_METHODS,
  METRIC_METHOD_LABELS,
  type MetricChannel,
  type MetricCollectionMethod,
} from "@/lib/metric-types";

type MetricRow = {
  id: string;
  name: string;
  channel: string | null;
  unit: string;
  collectionMethod: string;
  cadenceGoal: number | null;
  notes: string | null;
  latestSample: {
    value: number;
    recordedAt: string;
    source: string;
    notes: string | null;
  } | null;
};

export function MetricsStudio({ businessId }: { businessId: string | null }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [contentHealth, setContentHealth] =
    useState<ContentHealthCounts>(emptyContentHealth());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<MetricChannel | "">("linkedin");
  const [method, setMethod] = useState<MetricCollectionMethod>("manual");
  const [creating, setCreating] = useState(false);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/metrics");
    if (res.status === 401) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      toast.error("Could not load metrics");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMetrics(data.metrics || []);
    setContentHealth(data.contentHealth || emptyContentHealth());
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!businessId) {
      setMetrics([]);
      setContentHealth(emptyContentHealth());
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [businessId, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          channel: channel || null,
          collectionMethod: method,
          unit: "count",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setName("");
      toast.success("Metric defined");
      await load();
    } catch {
      toast.error("Could not create metric");
    } finally {
      setCreating(false);
    }
  }

  async function handleRecord(metricId: string) {
    const raw = sampleValues[metricId]?.trim();
    if (!raw) {
      toast.error("Enter a value");
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      toast.error("Value must be a number");
      return;
    }
    setRecordingId(metricId);
    try {
      const res = await fetch(`/api/metrics/${metricId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, source: "manual" }),
      });
      if (!res.ok) throw new Error("Failed");
      setSampleValues((prev) => ({ ...prev, [metricId]: "" }));
      toast.success("Sample recorded");
      await load();
    } catch {
      toast.error("Could not record sample");
    } finally {
      setRecordingId(null);
    }
  }

  async function handleDelete(metricId: string, metricName: string) {
    if (!window.confirm(`Delete metric “${metricName}”?`)) return;
    try {
      const res = await fetch(`/api/metrics/${metricId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      await load();
    } catch {
      toast.error("Could not delete");
    }
  }

  if (!businessId) {
    return (
      <p className="text-sm text-text-muted">
        Select a business to set up monitoring.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading metrics…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Content health</h2>
            <p className="text-sm text-text-muted">
              Pipeline counts from your in-app Content inventory.
            </p>
          </div>
          <Link href="/content" className="text-xs text-accent hover:underline">
            Open Content →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {(["total", ...CONTENT_STATUSES] as const).map((key) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-bg-panel px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                {key === "total" ? "Total" : CONTENT_STATUS_LABELS[key as ContentStatus]}
              </div>
              <div className="text-lg font-semibold tabular-nums">
                {key === "total" ? contentHealth.total : contentHealth[key]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Channel metrics</h2>
          <p className="text-sm text-text-muted">
            Define what to track (followers, impressions, comments). Record
            samples manually now; Hermes collection jobs come next.
          </p>
        </div>

        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-bg-panel p-3"
        >
          <label className="flex flex-col gap-1 text-xs text-text-muted min-w-[10rem] flex-1">
            Name
            <input
              className="input text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LinkedIn followers"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Channel
            <select
              className="input text-sm py-1.5"
              value={channel}
              onChange={(e) => setChannel(e.target.value as MetricChannel | "")}
            >
              <option value="">None</option>
              {METRIC_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {METRIC_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Collection
            <select
              className="input text-sm py-1.5"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as MetricCollectionMethod)
              }
            >
              {METRIC_COLLECTION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METRIC_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn-primary text-xs flex items-center gap-1.5"
            disabled={creating || !name.trim()}
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add metric
          </button>
        </form>

        {metrics.length === 0 ? (
          <p className="text-sm text-text-muted rounded-xl border border-dashed border-border px-4 py-8 text-center">
            No metrics yet. Start with followers or weekly posts shipped for
            your main channel.
          </p>
        ) : (
          <ul className="space-y-3">
            {metrics.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-border bg-bg-panel p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {m.channel
                        ? METRIC_CHANNEL_LABELS[m.channel as MetricChannel] ??
                          m.channel
                        : "No channel"}{" "}
                      ·{" "}
                      {METRIC_METHOD_LABELS[
                        m.collectionMethod as MetricCollectionMethod
                      ] ?? m.collectionMethod}{" "}
                      · unit: {m.unit}
                    </div>
                    {m.latestSample ? (
                      <div className="mt-2 text-sm">
                        <span className="text-xl font-semibold tabular-nums">
                          {m.latestSample.value}
                        </span>
                        <span className="ml-2 text-xs text-text-muted">
                          latest ·{" "}
                          {new Date(m.latestSample.recordedAt).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-text-muted">
                        No samples yet
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs p-1.5"
                    onClick={() => void handleDelete(m.id, m.name)}
                    title="Delete metric"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="input text-sm w-32"
                    type="number"
                    step="any"
                    placeholder="New value"
                    value={sampleValues[m.id] ?? ""}
                    onChange={(e) =>
                      setSampleValues((prev) => ({
                        ...prev,
                        [m.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={recordingId === m.id}
                    onClick={() => void handleRecord(m.id)}
                  >
                    {recordingId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Record sample"
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
