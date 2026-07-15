"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Settings2 } from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { ChatMarkdown } from "@/components/ui/ChatMarkdown";
import type { AutomationMessage } from "@/lib/automation-types";

interface AutomationChatProps {
  messages: AutomationMessage[];
  processName: string;
  isLoading: boolean;
  onSend: (content: string) => void;
  onOpenConnection: () => void;
  /**
   * When embedded in the global chatbar, hide the local header
   * (connection + title live in ChatbarPanel).
   */
  embedded?: boolean;
}

export function AutomationChat({
  messages,
  processName,
  isLoading,
  onSend,
  onOpenConnection,
  embedded = false,
}: AutomationChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { config: hermesConfig, isConnected } = useHermesConnection();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
    <div
      className={
        embedded
          ? "flex-1 flex flex-col h-full min-h-0 text-text overflow-hidden automation-chat--embedded"
          : "w-[380px] shrink-0 border-l border-border bg-bg flex flex-col h-full"
      }
    >
      {!embedded ? (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted">
              Automation chat
            </div>
            <div className="text-sm font-medium truncate max-w-[240px]">
              {processName}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenConnection}
            className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text transition-colors"
            title="Hermes connection"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && !isLoading ? (
          <p className="text-xs text-text-muted leading-relaxed">
            Design this automation with Hermes — recommend Hermes cron vs n8n,
            list integrations, and build a deploy-ready plan.
          </p>
        ) : null}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`chat-message text-sm ${
                msg.role === "user"
                  ? "bg-white text-black"
                  : "bg-bg-panel border border-border text-text"
              }`}
            >
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              ) : (
                <ChatMarkdown markdown={msg.content} className="leading-relaxed" />
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-message bg-bg-panel border border-border flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Hermes is designing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border shrink-0">
        {!isConnected && (
          <div className="mb-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <button type="button" onClick={onOpenConnection} className="hover:underline">
              Connect to Hermes
            </button>{" "}
            to design the automation.
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="input flex-1 resize-none min-h-[44px] max-h-32 text-sm"
            placeholder="Describe what to automate, schedule, tools..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={2}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !hermesConfig}
            className="btn-primary self-end"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          Hermes recommends Hermes cron vs n8n and lists required integrations.
          Deploy from the left panel when the plan is ready.
        </p>
      </div>
    </div>
  );
}
