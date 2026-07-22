"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type {
  HermesSessionMessage,
  HermesSessionSummary,
} from "@/lib/hermes-sessions";
import { sessionDisplayTitle } from "@/lib/hermes-sessions";

const PAGE_SIZE = 40;

function formatWhen(iso: string | number | null | undefined): string {
  if (iso == null || iso === "") return "—";
  try {
    const d =
      typeof iso === "number"
        ? new Date(iso > 1e12 ? iso : iso * 1000)
        : new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function formatTokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function roleClass(role: string): string {
  const r = role.toLowerCase();
  if (r === "user") return "bg-bg-elevated";
  if (r === "assistant") return "bg-bg-subtle";
  if (r === "system") return "opacity-85 border-dashed";
  if (r === "tool") return "bg-bg text-xs";
  return "";
}

export function SessionsStudio() {
  const { config, isConnected } = useHermesConnection();
  const [sessions, setSessions] = useState<HermesSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [includeChildren, setIncludeChildren] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HermesSessionSummary | null>(null);
  const [messages, setMessages] = useState<HermesSessionMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatting, setChatting] = useState(false);

  const creds = useMemo(() => {
    if (!config?.baseUrl || !config?.apiKey) return null;
    return { baseUrl: config.baseUrl, apiKey: config.apiKey };
  }, [config?.baseUrl, config?.apiKey]);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? detail,
    [sessions, selectedId, detail],
  );

  const loadSessions = useCallback(
    async (nextOffset = 0, append = false, opts?: { source?: string; children?: boolean }) => {
      if (!creds) {
        setSessions([]);
        setHasMore(false);
        return;
      }
      const source = opts?.source ?? sourceFilter;
      const children = opts?.children ?? includeChildren;
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          baseUrl: creds.baseUrl,
          apiKey: creds.apiKey,
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });
        if (source.trim()) qs.set("source", source.trim());
        if (children) qs.set("include_children", "true");

        const res = await fetch(`/api/hermes/sessions?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to list sessions");

        const list = (data.sessions ?? []) as HermesSessionSummary[];
        setSessions((prev) => (append ? [...prev, ...list] : list));
        setOffset(nextOffset);
        setHasMore(Boolean(data.hasMore));
        setSelectedId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          if (prev && append) return prev;
          if (!append) return list[0]?.id ?? null;
          return prev;
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to list sessions");
        if (!append) setSessions([]);
      } finally {
        setLoading(false);
      }
    },
    // sourceFilter / includeChildren read at call time; intentional for Enter-to-apply
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creds],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      if (!creds) return;
      setMessagesLoading(true);
      try {
        const qs = new URLSearchParams({
          baseUrl: creds.baseUrl,
          apiKey: creds.apiKey,
        });
        const [metaRes, msgRes] = await Promise.all([
          fetch(`/api/hermes/sessions/${encodeURIComponent(id)}?${qs}`),
          fetch(
            `/api/hermes/sessions/${encodeURIComponent(id)}/messages?${qs}`,
          ),
        ]);
        const meta = await metaRes.json();
        const msgs = await msgRes.json();
        if (!metaRes.ok) throw new Error(meta.error || "Failed to load session");
        if (!msgRes.ok) throw new Error(msgs.error || "Failed to load messages");

        const session = meta.session as HermesSessionSummary;
        setDetail(session);
        setEditTitle(session.title ?? "");
        setMessages(msgs.messages ?? []);
        setResolvedSessionId(msgs.sessionId ?? id);
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...session } : s)),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load session");
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [creds],
  );

  useEffect(() => {
    if (!isConnected || !creds) {
      setSessions([]);
      setSelectedId(null);
      setDetail(null);
      setMessages([]);
      return;
    }
    void loadSessions(0, false, {
      source: sourceFilter,
      children: includeChildren,
    });
    // Re-fetch when connection, children toggle, or explicit filter apply changes.
    // sourceFilter is applied on Enter / filter button, not each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, creds, includeChildren, loadSessions]);

  useEffect(() => {
    if (!selectedId || !creds) {
      setDetail(null);
      setMessages([]);
      setResolvedSessionId(null);
      return;
    }
    setEditingTitle(false);
    setChatDraft("");
    void loadDetail(selectedId);
  }, [selectedId, creds, loadDetail]);

  async function handleCreate() {
    if (!creds) return;
    setCreating(true);
    try {
      const res = await fetch("/api/hermes/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...creds,
          title: `Forge session ${new Date().toLocaleString()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Session created");
      await loadSessions(0, false);
      if (data.session?.id) setSelectedId(data.session.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename() {
    if (!creds || !selectedId) return;
    setBusyAction("rename");
    try {
      const res = await fetch(
        `/api/hermes/sessions/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...creds, title: editTitle }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");
      toast.success("Title updated");
      setEditingTitle(false);
      if (data.session) {
        setDetail(data.session);
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedId ? { ...s, ...data.session } : s)),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEnd() {
    if (!creds || !selectedId) return;
    if (!window.confirm("Mark this session as ended?")) return;
    setBusyAction("end");
    try {
      const res = await fetch(
        `/api/hermes/sessions/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...creds, endReason: "ended_by_user" }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "End failed");
      toast.success("Session ended");
      if (data.session) {
        setDetail(data.session);
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedId ? { ...s, ...data.session } : s)),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "End failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!creds || !selectedId) return;
    if (
      !window.confirm(
        "Delete this Hermes session permanently? This cannot be undone.",
      )
    ) {
      return;
    }
    setBusyAction("delete");
    try {
      const res = await fetch(
        `/api/hermes/sessions/${encodeURIComponent(selectedId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creds),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Session deleted");
      setSelectedId(null);
      setDetail(null);
      setMessages([]);
      await loadSessions(0, false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFork() {
    if (!creds || !selectedId) return;
    const title = window.prompt(
      "Title for the forked session (optional):",
      selected?.title ? `${selected.title} fork` : "fork",
    );
    if (title === null) return;
    setBusyAction("fork");
    try {
      const res = await fetch(
        `/api/hermes/sessions/${encodeURIComponent(selectedId)}/fork`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...creds,
            title: title.trim() || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fork failed");
      toast.success("Session forked (source marked branched)");
      await loadSessions(0, false);
      if (data.session?.id) setSelectedId(data.session.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fork failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChat() {
    if (!creds || !selectedId) return;
    const message = chatDraft.trim();
    if (!message) return;
    setChatting(true);
    try {
      const res = await fetch(
        `/api/hermes/sessions/${encodeURIComponent(selectedId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...creds, message }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setChatDraft("");
      await loadDetail(selectedId);
      toast.success("Turn completed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setChatting(false);
    }
  }

  if (!isConnected || !creds) {
    return (
      <div className="card border border-border bg-bg-elevated p-8 text-center max-w-lg mx-auto">
        <MessageSquare className="w-8 h-8 mx-auto mb-3 text-text-muted" />
        <h2 className="text-lg font-semibold mb-2">Connect Hermes</h2>
        <p className="text-sm text-text-muted">
          Sessions are stored on your Hermes Agent API server. Connect Hermes
          (Settings or the connection badge) to list, fork, chat, and delete
          sessions via{" "}
          <code className="text-xs bg-bg-subtle px-1 rounded">/api/sessions</code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="sessions-studio grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-4 min-h-[min(70vh,720px)]">
      {/* List */}
      <aside className="card border border-border bg-bg-panel flex flex-col min-h-[320px] max-h-[min(70vh,720px)] overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button
            type="button"
            className="btn-primary text-sm inline-flex items-center gap-1.5"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            New
          </button>
          <button
            type="button"
            className="btn-secondary text-sm p-2"
            title="Refresh"
            aria-label="Refresh sessions"
            onClick={() => void loadSessions(0, false)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeChildren}
              onChange={(e) => setIncludeChildren(e.target.checked)}
              className="rounded border-border"
            />
            Children
          </label>
        </div>

        <div className="p-3 border-b border-border flex gap-2">
          <input
            type="search"
            className="input flex-1 text-sm"
            placeholder="Filter by source (api_server, cron…)"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void loadSessions(0, false, {
                  source: sourceFilter,
                  children: includeChildren,
                });
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary text-sm shrink-0"
            onClick={() =>
              void loadSessions(0, false, {
                source: sourceFilter,
                children: includeChildren,
              })
            }
          >
            Filter
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && sessions.length === 0 ? (
            <div className="p-6 text-sm text-text-muted flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">
              No Hermes sessions found. Create one or run a chat through Hermes
              first.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => {
                const active = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2.5 hover:bg-bg-subtle transition-colors ${
                        active
                          ? "border-l-2 border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                          : ""
                      }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="text-sm font-medium truncate">
                        {sessionDisplayTitle(s)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
                        {s.source && <span>{s.source}</span>}
                        {s.messageCount != null && (
                          <span>{s.messageCount} msgs</span>
                        )}
                        {s.endReason && (
                          <span className="text-[var(--amber)]">{s.endReason}</span>
                        )}
                        <span className="ml-auto">{formatWhen(s.lastActive ?? s.startedAt)}</span>
                      </div>
                      {s.preview && (
                        <p className="mt-1 text-xs text-text-faint line-clamp-2">
                          {s.preview}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasMore && (
          <div className="p-2 border-t border-border">
            <button
              type="button"
              className="btn-secondary w-full text-sm"
              disabled={loading}
              onClick={() => void loadSessions(offset + PAGE_SIZE, true)}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </aside>

      {/* Detail */}
      <section className="card border border-border bg-bg-panel flex flex-col min-h-[320px] max-h-[min(70vh,720px)] overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-text-muted p-8">
            Select a session to view messages and manage it.
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-border space-y-3">
              <div className="flex flex-wrap items-start gap-2">
                {editingTitle ? (
                  <div className="flex flex-1 min-w-[200px] gap-2">
                    <input
                      className="input flex-1 text-sm"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename();
                        if (e.key === "Escape") setEditingTitle(false);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      disabled={busyAction === "rename"}
                      onClick={() => void handleRename()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => {
                        setEditingTitle(false);
                        setEditTitle(selected.title ?? "");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold flex-1 min-w-0 truncate">
                    {sessionDisplayTitle(selected)}
                  </h2>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                    onClick={() => setEditingTitle(true)}
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                    disabled={busyAction === "fork"}
                    onClick={() => void handleFork()}
                    title="Fork (branch) this session"
                  >
                    <GitBranch className="w-3 h-3" /> Fork
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                    disabled={busyAction === "end" || Boolean(selected.endReason)}
                    onClick={() => void handleEnd()}
                    title="End session"
                  >
                    <XCircle className="w-3 h-3" /> End
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs inline-flex items-center gap-1 text-[var(--red)]"
                    disabled={busyAction === "delete"}
                    onClick={() => void handleDelete()}
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <MetaPill label="ID" value={selected.id} mono />
                <MetaPill label="Source" value={selected.source ?? "—"} />
                <MetaPill label="Model" value={selected.model ?? "—"} />
                <MetaPill
                  label="End"
                  value={selected.endReason ?? (selected.endedAt ? "ended" : "active")}
                />
                <MetaPill
                  label="Messages"
                  value={
                    selected.messageCount != null
                      ? String(selected.messageCount)
                      : "—"
                  }
                />
                <MetaPill
                  label="Tokens in/out"
                  value={`${formatTokens(selected.inputTokens)} / ${formatTokens(selected.outputTokens)}`}
                />
                <MetaPill
                  label="Last active"
                  value={formatWhen(selected.lastActive ?? selected.startedAt)}
                />
                <MetaPill
                  label="Parent"
                  value={selected.parentSessionId ?? "—"}
                  mono
                />
              </div>
              {resolvedSessionId && resolvedSessionId !== selected.id && (
                <p className="text-xs text-[var(--amber)]">
                  Messages resolved via lineage tip{" "}
                  <code className="font-mono">{resolvedSessionId}</code> (post-compression).
                </p>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="text-sm text-text-muted flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-text-muted">
                  No messages in this session yet. Send a turn below to chat
                  through the Hermes Sessions API.
                </div>
              ) : (
                messages.map((m, i) => (
                  <article
                    key={m.id ?? `${m.role}-${i}`}
                    className={`rounded-lg border border-border px-3 py-2 text-sm ${roleClass(m.role)}`}
                  >
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-text-muted mb-1">
                      <span>{m.role}</span>
                      {m.toolName && <span>· {m.toolName}</span>}
                      {m.timestamp != null && (
                        <span className="ml-auto normal-case tracking-normal">
                          {formatWhen(m.timestamp)}
                        </span>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-text">
                      {m.content || (
                        <span className="text-text-faint italic">(empty)</span>
                      )}
                    </pre>
                    {m.reasoning || m.reasoningContent ? (
                      <details className="mt-2 text-xs text-text-muted">
                        <summary className="cursor-pointer">Reasoning</summary>
                        <pre className="mt-1 whitespace-pre-wrap font-sans">
                          {m.reasoning || m.reasoningContent}
                        </pre>
                      </details>
                    ) : null}
                  </article>
                ))
              )}
            </div>

            <footer className="p-3 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  className="input flex-1 text-sm min-h-[44px] max-h-32 resize-y"
                  rows={2}
                  placeholder="Send a turn on this Hermes session…"
                  value={chatDraft}
                  disabled={chatting || Boolean(selected.endReason)}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleChat();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-primary self-end inline-flex items-center gap-1.5 text-sm px-3"
                  disabled={
                    chatting ||
                    !chatDraft.trim() ||
                    Boolean(selected.endReason)
                  }
                  onClick={() => void handleChat()}
                  title="Send (Ctrl/⌘+Enter)"
                >
                  {chatting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-text-faint">
                Uses{" "}
                <code>POST /api/sessions/{"{id}"}/chat</code> — full agent
                turn with tools. Ctrl/⌘+Enter to send.
              </p>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function MetaPill({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div
        className={`truncate text-text ${mono ? "font-mono text-[11px]" : "text-xs"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
