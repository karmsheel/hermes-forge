"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  GraduationCap,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useShell } from "@/components/shell/ShellContext";
import {
  AGENT_TRAINING_KINDS,
  labelForTrainingKind,
  type AgentTrainingKind,
} from "@/lib/personnel/agent-training";

type HiredAgentOption = {
  id: string;
  displayName: string;
  profileKey: string;
  model: string | null;
};

type AcademyItem = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  content: string;
  fileName: string | null;
  source: string;
  hermesAgentProfileId: string | null;
  hermesAgentProfile: { id: string; displayName: string } | null;
  createdAt: string;
};

export default function AgentAcademyPage() {
  const { currentBusiness } = useShell();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AcademyItem[]>([]);
  const [hiredAgents, setHiredAgents] = useState<HiredAgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<AgentTrainingKind>("skill");
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personnel/academy");
      if (!res.ok) throw new Error("Failed to load academy");
      const data = await res.json();
      setItems(data.items || []);
      setHiredAgents(data.hiredAgents || []);
    } catch {
      toast.error("Could not load Agent Academy");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentBusiness?.id]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setContent(text);
      setFileName(file.name);
      if (!name.trim()) {
        setName(file.name.replace(/\.[^.]+$/, "") || file.name);
      }
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Add content or upload a file");
      return;
    }
    if (!name.trim()) {
      toast.error("Give this training item a name");
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/personnel/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          content: content.trim(),
          fileName,
          hermesAgentProfileId: agentId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setItems((prev) => [data, ...prev]);
      setName("");
      setContent("");
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(`Added ${labelForTrainingKind(kind)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAssign(itemId: string, nextAgentId: string) {
    try {
      const res = await fetch(`/api/personnel/academy/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hermesAgentProfileId: nextAgentId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setItems((prev) => prev.map((item) => (item.id === itemId ? data : item)));
      toast.success("Assignment updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    }
  }

  async function handleDelete(itemId: string) {
    try {
      const res = await fetch(`/api/personnel/academy/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-medium">Agent Academy</h2>
            <p className="text-sm text-text-muted mt-1 max-w-2xl leading-relaxed">
              Train hired agents by loading skills and soul profiles. Upload files now; a
              shared searchable library is planned so you can tap into community packs later.
            </p>
          </div>
        </div>

        <div className="card p-4 mb-6 border-dashed bg-bg-subtle/50">
          <div className="flex items-start gap-2 text-sm text-text-muted">
            <BookOpen className="w-4 h-4 mt-0.5 shrink-0 text-text-soft" />
            <p>
              <span className="text-text font-medium">Shared library (coming soon)</span> —
              browse and install community skills and souls. For now, upload your own{" "}
              <code className="text-xs">.md</code>, <code className="text-xs">.txt</code>,{" "}
              <code className="text-xs">.yaml</code>, or skill packs from disk.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleUpload(e)} className="card p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-widest">
                Type
              </label>
              <select
                className="input w-full mt-1"
                value={kind}
                onChange={(e) => setKind(e.target.value as AgentTrainingKind)}
              >
                {AGENT_TRAINING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {labelForTrainingKind(k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-widest">
                Assign to agent
              </label>
              <select
                className="input w-full mt-1"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Business library (unassigned)</option>
                {hiredAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">
              Name
            </label>
            <input
              className="input w-full mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Process mapping skill"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-xs text-text-muted uppercase tracking-widest">
              Content
            </label>
            <textarea
              className="input w-full mt-1 min-h-[140px] font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste skill instructions or soul profile text…"
            />
            {fileName && (
              <p className="text-xs text-text-soft mt-1">From file: {fileName}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,.yaml,.yml,.json,.skill,text/*"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Upload file
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save to academy"
              )}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Training library</h2>
        {loading ? (
          <div className="text-center py-12 text-text-muted">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="card p-8 text-center border-dashed text-sm text-text-muted">
            No skills or soul profiles yet. Upload your first pack above.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.name}</span>
                      <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-text-muted">
                        {labelForTrainingKind(item.kind)}
                      </span>
                      <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-amber">
                        {item.source === "library" ? "Library" : "Upload"}
                      </span>
                    </div>
                    {item.fileName && (
                      <p className="text-xs text-text-soft mt-1">{item.fileName}</p>
                    )}
                    <p className="text-xs text-text-muted mt-2 line-clamp-2 font-mono">
                      {item.content.slice(0, 180)}
                      {item.content.length > 180 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="input text-xs py-1.5 max-w-[10rem]"
                      value={item.hermesAgentProfileId || ""}
                      onChange={(e) => void handleAssign(item.id, e.target.value)}
                      title="Assign to hired agent"
                    >
                      <option value="">Unassigned</option>
                      {hiredAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2 py-1.5 text-red-400 hover:text-red-300"
                      onClick={() => void handleDelete(item.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
