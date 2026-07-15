"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShell } from "@/components/shell/ShellContext";
import { eventCategory, type BusinessEventRecord, type BusinessLogFilter } from "@/lib/business-log-types";
import { parseEventMetadata } from "@/lib/business-log";

const FILTERS: { id: BusinessLogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "process", label: "Processes" },
  { id: "automation", label: "Automations" },
  { id: "chat", label: "Chat" },
  { id: "business", label: "Business" },
  { id: "memory", label: "Memory" },
  { id: "document", label: "Documents" },
  { id: "content", label: "Content" },
  { id: "metric", label: "Metrics" },
  { id: "personnel", label: "Personnel" },
  { id: "decision", label: "Decisions" },
];

function categoryLabel(type: string): string {
  const category = eventCategory(type);
  if (category === "all") return "Event";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function eventTimestamp(event: BusinessEventRecord): string {
  return event.occurredAt ?? event.recordedAt;
}

function dateKey(dateStr: string): string {
  return new Date(dateStr).toDateString();
}

function formatTimelineDate(dateStr: string): { day: string; year: string } {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  let day: string;
  if (date.toDateString() === today.toDateString()) {
    day = "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    day = "Yesterday";
  } else {
    day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return {
    day,
    year: date.toLocaleDateString(undefined, { year: "numeric" }),
  };
}

function formatTimelineTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRecordedNote(event: BusinessEventRecord): string | null {
  if (!event.occurredAt) return null;
  const occurredMs = new Date(event.occurredAt).getTime();
  const recordedMs = new Date(event.recordedAt).getTime();
  if (Math.abs(occurredMs - recordedMs) < 60_000) return null;
  return `Recorded ${formatTimelineDate(event.recordedAt).day}, ${formatTimelineTime(event.recordedAt)}`;
}

function BusinessLogFeedList({
  businessId,
  filter,
}: {
  businessId: string | null;
  filter: BusinessLogFilter;
}) {
  const [events, setEvents] = useState<BusinessEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);

    fetch(`/api/business/log?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          window.location.href = "/";
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setEvents((data.events ?? []) as BusinessEventRecord[]);
        setNextCursor(data.nextCursor ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to load business log");
        setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, filter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      params.set("cursor", nextCursor);

      const res = await fetch(`/api/business/log?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      const page: BusinessEventRecord[] = data.events ?? [];
      setNextCursor(data.nextCursor ?? null);
      setEvents((prev) => [...prev, ...page]);
    } catch {
      toast.error("Failed to load more activity");
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, nextCursor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading activity…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card p-8 text-center text-text-muted">
        <p className="mb-2">No activity yet.</p>
        <p className="text-sm">
          Start mapping a process from{" "}
          <Link href="/home" className="text-accent hover:underline">
            Home
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <div
          className="absolute top-3 bottom-3 w-px bg-border"
          style={{ left: "calc(5.75rem + 0.6875rem)" }}
          aria-hidden
        />
        <ul>
          {events.map((event, index) => {
            const meta = parseEventMetadata(event.metadata);
            const timestamp = eventTimestamp(event);
            const currentDateKey = dateKey(timestamp);
            const prevTimestamp =
              index > 0 ? eventTimestamp(events[index - 1]) : null;
            const showDate =
              !prevTimestamp || dateKey(prevTimestamp) !== currentDateKey;
            const { day, year } = formatTimelineDate(timestamp);
            const recordedNote = formatRecordedNote(event);

            return (
              <li
                key={event.id}
                className="grid grid-cols-[5.75rem_1.375rem_1fr] gap-x-3"
              >
                <div className="text-right pt-0.5 pr-1">
                  {showDate ? (
                    <>
                      <div className="text-xs font-medium text-text-muted leading-tight">
                        {day}
                      </div>
                      <div className="text-[10px] text-text-faint mt-0.5">
                        {year}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-text-faint leading-tight">
                      {formatTimelineTime(timestamp)}
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-1.5 relative z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-bg border-2 border-border-strong shrink-0" />
                </div>

                <div className="pb-10 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="pill text-[10px] uppercase tracking-wider">
                      {categoryLabel(event.type)}
                    </span>
                    {event.ingestion === "backfill" && (
                      <span className="text-[10px] text-text-faint uppercase tracking-wider">
                        backfilled
                      </span>
                    )}
                    {showDate && (
                      <span className="text-[10px] text-text-faint">
                        {formatTimelineTime(timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text leading-relaxed">
                    {event.summary}
                  </p>
                  {recordedNote && (
                    <p className="text-[10px] text-text-faint mt-1">
                      {recordedNote}
                    </p>
                  )}
                  {meta?.preview && (
                    <p className="text-xs text-text-muted mt-2 leading-relaxed">
                      &ldquo;{meta.preview}&rdquo;
                    </p>
                  )}
                  {meta?.changes && meta.changes.length > 0 && (
                    <ul className="text-xs text-text-muted mt-2 space-y-0.5">
                      {meta.changes.map((change) => (
                        <li key={change.field}>
                          {change.field}: {String(change.before ?? "—")} →{" "}
                          {String(change.after ?? "—")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {nextCursor && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}

    </>
  );
}

export function BusinessLogFeed() {
  const { currentBusiness } = useShell();
  const [filter, setFilter] = useState<BusinessLogFilter>("all");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`pill text-xs ${filter === item.id ? "pill-accent" : "border border-border text-text-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <BusinessLogFeedList
        key={`${currentBusiness?.id ?? "no-business"}-${filter}`}
        businessId={currentBusiness?.id ?? null}
        filter={filter}
      />
    </div>
  );
}