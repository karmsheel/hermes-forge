"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
} from "lucide-react";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { useShell } from "@/components/shell/ShellContext";
import type { DecisionRequestRecord } from "@/lib/decision-types";

type DecisionRecordRow = {
  id: string;
  title: string;
  statement: string;
  kind: string;
  status: string;
  decidedAt: string | null;
  recordedAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
};

export default function DecisionsPage() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const { openDecisionSession } = useChatbar();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<DecisionRequestRecord[]>([]);
  const [records, setRecords] = useState<DecisionRecordRow[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [redirectDraft, setRedirectDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setPending(data.pending ?? []);
      setRecords(data.records ?? []);
    } catch {
      toast.error("Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  async function resolve(
    request: DecisionRequestRecord,
    optionId: string,
    comment?: string
  ) {
    setResolvingId(request.id);
    try {
      const res = await fetch(`/api/decisions/${request.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, comment: comment ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve");

      if (data.openChatbar) {
        openDecisionSession({
          hermesAgentProfileId: data.openChatbar.hermesAgentProfileId,
          conversationId: data.openChatbar.conversationId,
          prefill: data.openChatbar.prefill ?? comment ?? undefined,
        });
        toast.info("Continue with the agent in chat");
      } else {
        toast.success("Decision recorded");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Governance
        </div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Scale className="w-7 h-7 text-accent" />
          Decisions
        </h1>
        <p className="text-sm text-text-muted mt-3 max-w-2xl">
          Human-in-the-loop approvals for forged business knowledge. Agents propose;
          you authorize, reject, or redirect with instructions.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Needs your decision
              {pending.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {pending.length}
                </span>
              )}
            </h2>

            {pending.length === 0 ? (
              <div className="card p-8 text-center text-text-muted text-sm">
                No pending decisions. When agents or Forge need approval to change
                forged processes or documents, they appear here.
              </div>
            ) : (
              <ul className="space-y-4">
                {pending.map((req) => (
                  <li key={req.id} className="card p-5 border border-border">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-strong">{req.title}</div>
                        <p className="text-sm text-text-muted mt-1">{req.summary}</p>
                      </div>
                      {req.urgency === "high" && (
                        <span className="text-[10px] uppercase tracking-widest text-red-400 shrink-0">
                          High
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-text-soft mb-3">
                      <span className="px-2 py-0.5 rounded bg-bg-muted">
                        {req.proposerKind}
                        {req.agent ? ` · ${req.agent.displayName}` : ""}
                      </span>
                      {req.relatedEntityName && (
                        <span className="px-2 py-0.5 rounded bg-bg-muted">
                          {req.relatedEntityType}: {req.relatedEntityName}
                        </span>
                      )}
                    </div>
                    {req.contextMarkdown && (
                      <pre className="text-xs text-text-muted whitespace-pre-wrap bg-bg/50 border border-border rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
                        {req.contextMarkdown}
                      </pre>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {req.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={resolvingId === req.id}
                          onClick={() => {
                            if (opt.kind === "redirect") {
                              const msg =
                                redirectDraft[req.id]?.trim() ||
                                "Please adjust the approach and come back with a revised proposal.";
                              void resolve(req, opt.id, msg);
                              return;
                            }
                            void resolve(req, opt.id);
                          }}
                          className={
                            opt.kind === "approve" || opt.primary
                              ? "btn-primary text-xs px-3 py-1.5"
                              : opt.kind === "reject"
                                ? "btn-secondary text-xs px-3 py-1.5 text-red-300"
                                : "btn-secondary text-xs px-3 py-1.5"
                          }
                        >
                          {resolvingId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            opt.label
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 items-start">
                      <textarea
                        className="input text-xs flex-1 min-h-[60px]"
                        placeholder="Redirect / comment: tell the agent what to do instead…"
                        value={redirectDraft[req.id] ?? ""}
                        onChange={(e) =>
                          setRedirectDraft((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary text-xs px-3 py-2 flex items-center gap-1 shrink-0"
                        disabled={resolvingId === req.id}
                        onClick={() => {
                          const redirectOpt =
                            req.options.find((o) => o.kind === "redirect") ??
                            req.options[req.options.length - 1];
                          if (!redirectOpt) return;
                          void resolve(
                            req,
                            redirectOpt.id,
                            redirectDraft[req.id]?.trim() ||
                              "Please revise based on my feedback."
                          );
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Redirect
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green" />
              Recent decisions
            </h2>
            {records.length === 0 ? (
              <div className="card p-6 text-sm text-text-muted">
                No decision records yet. Forging processes/documents and resolving
                approvals will appear here and in the{" "}
                <Link href="/log" className="text-accent hover:underline">
                  business log
                </Link>
                .
              </div>
            ) : (
              <ul className="space-y-2">
                {records.map((r) => (
                  <li
                    key={r.id}
                    className="card p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                        {r.statement}
                      </p>
                    </div>
                    <div className="text-[10px] text-text-soft shrink-0 text-right">
                      <div className="uppercase tracking-widest">{r.kind}</div>
                      <div>
                        {new Date(r.decidedAt ?? r.recordedAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
