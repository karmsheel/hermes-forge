"use client";

import { useEffect, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Loader2, Send } from "lucide-react";
import { useHermesConnection } from "@/components/hermes/HermesConnectionProvider";
import { HOME_PROMPT_EXAMPLES } from "@/lib/home-prompt";

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (brief: string) => void | Promise<void>;
  sending?: boolean;
  onOpenConnection: () => void;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  footerExtra?: ReactNode;
}

export function PromptComposer({
  value,
  onChange,
  onSend,
  sending = false,
  onOpenConnection,
  composerRef,
  footerExtra,
}: PromptComposerProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const { config: hermesConfig, isConnected } = useHermesConnection();

  const trimmed = value.trim();
  const canSend = !!trimmed && !!hermesConfig && isConnected && !sending;

  useEffect(() => {
    if (trimmed) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % HOME_PROMPT_EXAMPLES.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [trimmed]);

  async function performSend() {
    if (!trimmed) return;

    if (!hermesConfig || !isConnected) {
      onOpenConnection();
      return;
    }

    await onSend(trimmed);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await performSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void performSend();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="home-composer">
      <div className="home-composer__card">
        <textarea
          ref={composerRef}
          className="home-composer__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={HOME_PROMPT_EXAMPLES[placeholderIndex]}
          rows={5}
          disabled={sending}
        />
        <div className="home-composer__footer">
          <div className="home-composer__footer-meta">
            <p className="home-composer__hint">
              {!isConnected ? (
                <>
                  <button type="button" onClick={onOpenConnection} className="text-accent hover:underline">
                    Connect to Hermes
                  </button>{" "}
                  to start mapping
                </>
              ) : (
                "Describe a process — Hermes will build the diagram as you chat"
              )}
            </p>
            {footerExtra}
          </div>
          <button type="submit" disabled={!canSend} className="btn-primary home-composer__send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>
    </form>
  );
}