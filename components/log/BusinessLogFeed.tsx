"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShell } from "@/components/shell/ShellContext";
import { eventCategory, type BusinessEventRecord, type BusinessLogFilter } from "@/lib/business-log-types";
import { parseEventMetadata } from "@/lib/business-log";
import { timeAgo } from "@/lib/time-ago";
import { setActiveProcessId } from "@/lib/workshop-storage";

const FILTERS: { id: BusinessLogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "process", label: "Processes" },
  { id: "automation", label: "Automations" },
  { id: "chat", label: "Chat" },
  { id: "business", label: "Business" },
  { id: "memory", label: "Memory" },
];

function categoryLabel(type: string): string {
  const category = eventCategory(type);
  if (category === "all") return "Event";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function resolveProcessId(event: BusinessEventRecord): string | null {
  if (
    event.entityType === "process" ||
    event.entityType === "chat" ||
    event.entityType === "automation"
  ) {
    return event.entityId;
  }
  return null;
}

function eventHref(event: BusinessEventRecord): string | null {
  const processId = resolveProcessId(event);
  if (!processId) return null;
  if (event.entityType === "automation" || event.type.startsWith("automation.")) {
    return `/automations/${processId}`;
  }
  if (event.entityType === "process" || event.type.startsWith("chat.")) {
    return "/workshop";
  }
  return null;
}

export function BusinessLogFeed() {
  const { currentBusiness } = useShell();
  const [events, setEvents] = useState<BusinessEventRecord[]>([]);
  const [filter, setFilter] = useState<BusinessLogFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [bizName, setBizName] = useState<string | null>(null);

  const loadEvents = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean }) => {
      const isAppend = opts?.append === true;
      if (isAppend) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (filter !== "all") params.set("filter", filter);
        if (opts?.cursor) params.set("cursor", opts.cursor);

        const res = await fetch(`/api/business/log?${params.toString()}`);
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        const page: BusinessEventRecord[] = data.events ?? [];

        setBizName(data.business?.name ?? currentBusiness?.name ?? null);
        setNextCursor(data.nextCursor ?? null);
        setEvents((prev) => (isAppend ? [...prev, ...page] : page));
      } catch {
        toast.error("Failed to load business log");
        if (!isAppend) setEvents([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, currentBusiness?.name]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents, currentBusiness?.id]);

  function openEvent(event: BusinessEventRecord) {
    const processId = resolveProcessId(event);
    const businessId = currentBusiness?.id ?? event.businessId;
    if (processId && businessId) {
      setActiveProcessId(businessId, processId);
    }
  }

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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading activity…
        </div>
      ) : events.length === 0 ? (
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
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const meta = parseEventMetadata(event.metadata);
            const href = eventHref(event);
            const processId = resolveProcessId(event);

            const content = (
              <div className="card p-4 flex items-start gap-4 hover:bg-bg-subtle transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="pill text-[10px] uppercase tracking-wider">
                      {categoryLabel(event.type)}
                    </span>
                    {event.source === "backfill" && (
                      <span className="text-[10px] text-text-faint uppercase tracking-wider">
                        imported
                      </span>
                    )}
                    <span className="text-xs text-text-muted ml-auto shrink-0">
                      {timeAgo(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-text leading-relaxed">{event.summary}</p>
                  {meta?.preview && (
                    <p className="text-xs text-text-muted mt-2 line-clamp-2">
                      &ldquo;{meta.preview}&rdquo;
                    </p>
                  )}
                  {meta?.changes && meta.changes.length > 0 && (
                    <ul className="text-xs text-text-muted mt-2 space-y-0.5">
                      {meta.changes.slice(0, 3).map((change) => (
                        <li key={change.field}>
                          {change.field}: {String(change.before ?? "—")} →{" "}
                          {String(change.after ?? "—")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );

            if (href && processId) {
              return (
                <li key={event.id}>
                  <Link
                    href={href}
                    onClick={() => openEvent(event)}
                    className="block"
                  >
                    {content}
                  </Link>
                </li>
              );
            }

            return <li key={event.id}>{content}</li>;
          })}
        </ul>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={loadingMore}
            onClick={() => loadEvents({ cursor: nextCursor, append: true })}
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

      {bizName && events.length > 0 && (
        <p className="text-xs text-text-faint text-center mt-6">
          Showing activity for {bizName}
        </p>
      )}
    </div>
  );
}