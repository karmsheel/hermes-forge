"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Settings2 } from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type { ChatMessage } from "@/lib/types";
import { NodeContextPill } from "./DiagramComments";
import type { MermaidNodeInfo } from "./MermaidDiagram";

interface ProcessChatProps {
  messages: ChatMessage[];
  processName: string;
  isLoading: boolean;
  onSend: (content: string) => void;
  onOpenConnection: () => void;
  /** Increment to focus the composer (e.g. after creating a new process). */
  composerFocusKey?: number;
  /** Current selected node for targeting corrections (3.2). */
  selectedNode?: MermaidNodeInfo | null;
  onClearNodeContext?: () => void;
}

export function ProcessChat({
  messages,
  processName,
  isLoading,
  onSend,
  onOpenConnection,
  composerFocusKey = 0,
  selectedNode,
  onClearNodeContext,
}: ProcessChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config: hermesConfig, isConnected } = useHermesConnection();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!composerFocusKey) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [composerFocusKey]);

  // Track previous selection for smart prefix handling (3.2)
  const prevSelectedRef = useRef<typeof selectedNode>(null);

  // Handle node selection: set or replace the "Regarding" prefix.
  // This reacts to the object reference (so duplicate labels still trigger update).
  useEffect(() => {
    const label = selectedNode?.label;
    if (label) {
      setInput((current) => {
        const newPrefix = `Regarding "${label}": `;
        if (!current.trim()) {
          return newPrefix;
        }
        // If user already has a "Regarding ..." prefix, replace it with the new node's.
        const existingMatch = current.match(/^Regarding "[^"]+": /);
        if (existingMatch) {
          return newPrefix + current.slice(existingMatch[0].length);
        }
        return current;
      });
    }
    prevSelectedRef.current = selectedNode || null;
  }, [selectedNode]);

  // On deselect (background click), strip the old Regarding prefix if still present.
  useEffect(() => {
    if (!selectedNode && prevSelectedRef.current?.label) {
      const oldLabel = prevSelectedRef.current.label;
      const oldPrefix = `Regarding "${oldLabel}": `;
      setInput((current) => {
        if (current.startsWith(oldPrefix)) {
          return current.slice(oldPrefix.length);
        }
        return current;
      });
    }
  }, [selectedNode]);

  function handleSend() {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="w-[380px] shrink-0 border-l border-border bg-bg-panel text-text flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-muted">Chat</div>
          <div className="text-sm font-medium truncate max-w-[240px]">{processName}</div>
        </div>
        <button
          onClick={onOpenConnection}
          className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-strong transition-colors"
          title="Hermes connection"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`chat-message text-sm ${
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "bg-bg-elevated border border-border text-text"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-message bg-bg-elevated border border-border flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Hermes is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        {!isConnected && (
          <div className="mb-2 text-xs pill pill-amber rounded-lg px-3 py-2">
            <button type="button" onClick={onOpenConnection} className="hover:underline">
              Connect to Hermes
            </button>{" "}
            to start chatting.
          </div>
        )}
        {selectedNode && onClearNodeContext && (
          <NodeContextPill label={selectedNode.label} onClear={onClearNodeContext} />
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="input flex-1 resize-none min-h-[44px] max-h-32 text-sm"
            placeholder="Describe steps, actors, tools..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !hermesConfig}
            className="btn-primary self-end"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-text-soft mt-2">
          Each reply updates the diagram in the center. Correct anything that looks wrong.
        </p>
      </div>
    </div>
  );
}