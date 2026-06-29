"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Settings2 } from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import type { ChatMessage } from "@/lib/types";

interface ProcessChatProps {
  messages: ChatMessage[];
  processName: string;
  isLoading: boolean;
  onSend: (content: string) => void;
  onOpenConnection: () => void;
}

export function ProcessChat({
  messages,
  processName,
  isLoading,
  onSend,
  onOpenConnection,
}: ProcessChatProps) {
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
    <div className="w-[380px] shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500">Chat</div>
          <div className="text-sm font-medium truncate max-w-[240px]">{processName}</div>
        </div>
        <button
          onClick={onOpenConnection}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
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
                  ? "bg-white text-black"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-message bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Hermes is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800">
        {!isConnected && (
          <div className="mb-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <button type="button" onClick={onOpenConnection} className="hover:underline">
              Connect to Hermes
            </button>{" "}
            to start chatting.
          </div>
        )}
        <div className="flex gap-2">
          <textarea
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
        <p className="text-[10px] text-zinc-600 mt-2">
          Each reply updates the diagram in the center. Correct anything that looks wrong.
        </p>
      </div>
    </div>
  );
}