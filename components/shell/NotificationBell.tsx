"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { useShell } from "@/components/shell/ShellContext";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  decisionRequestId: string | null;
  readAt: string | null;
  createdAt: string;
  decisionRequest: {
    id: string;
    status: string;
    title: string;
    hermesAgentProfileId: string | null;
    conversationId: string | null;
    options: Array<{ id: string; label: string; kind: string }>;
  } | null;
};

export function NotificationBell() {
  const { currentBusiness } = useShell();
  const { openDecisionSession } = useChatbar();
  const [openPanel, setOpenPanel] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load, currentBusiness?.id]);

  useEffect(() => {
    if (!openPanel) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenPanel(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openPanel]);

  async function markRead(ids?: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids, read: true } : { all: true, read: true }),
    });
    await load();
  }

  async function resolveDecision(requestId: string, optionId: string) {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/decisions/${requestId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.openChatbar) {
        openDecisionSession({
          hermesAgentProfileId: data.openChatbar.hermesAgentProfileId,
          conversationId: data.openChatbar.conversationId,
          prefill: data.openChatbar.prefill,
        });
      } else {
        toast.success("Decision recorded");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        title="Notifications"
        aria-label="Notifications"
        onClick={() => {
          setOpenPanel((v) => !v);
          if (!openPanel) void load();
        }}
      >
        <Bell aria-hidden strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -top-px -right-px min-w-[14px] h-3.5 px-0.5 rounded-full bg-accent text-[9px] text-bg font-semibold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {openPanel && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[70vh] overflow-hidden card border border-border shadow-lg z-50 flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Notifications
            </span>
            <button
              type="button"
              className="text-[11px] text-accent hover:underline"
              onClick={() => void markRead()}
            >
              Mark all read
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-text-muted text-center">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`p-3 text-sm ${n.readAt ? "opacity-70" : "bg-bg-muted/30"}`}
                  >
                    <div className="font-medium text-text-strong text-xs">{n.title}</div>
                    {n.body && (
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {n.type === "decision_pending" &&
                        n.decisionRequest?.status === "pending" &&
                        n.decisionRequest.options
                          ?.filter((o) => o.kind !== "redirect")
                          .slice(0, 3)
                          .map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className="btn-secondary text-[10px] px-2 py-0.5"
                              disabled={busyId === n.decisionRequest!.id}
                              onClick={() =>
                                void resolveDecision(n.decisionRequest!.id, o.id)
                              }
                            >
                              {o.label}
                            </button>
                          ))}
                      {n.decisionRequestId && (
                        <Link
                          href="/decisions"
                          className="text-[10px] text-accent hover:underline px-1 py-0.5"
                          onClick={() => {
                            setOpenPanel(false);
                            void markRead([n.id]);
                          }}
                        >
                          Open decision
                        </Link>
                      )}
                      {n.type === "content_review" && (
                        <Link
                          href="/content"
                          className="text-[10px] text-accent hover:underline px-1 py-0.5"
                          onClick={() => {
                            setOpenPanel(false);
                            void markRead([n.id]);
                          }}
                        >
                          Open Content
                        </Link>
                      )}
                      {n.type === "automation_run_failed" && (
                        <Link
                          href="/automations"
                          className="text-[10px] text-accent hover:underline px-1 py-0.5"
                          onClick={() => {
                            setOpenPanel(false);
                            void markRead([n.id]);
                          }}
                        >
                          Open Automate
                        </Link>
                      )}
                    </div>
                    <div className="text-[10px] text-text-soft mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-2 text-center">
            <Link
              href="/decisions"
              className="text-xs text-accent hover:underline"
              onClick={() => setOpenPanel(false)}
            >
              All decisions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
