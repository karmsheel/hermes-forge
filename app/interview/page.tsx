"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Database, Target } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HermesConfig {
  baseUrl: string;
  apiKey: string;
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Hermes, your Business Analyst. Let's map out how your business actually works.\n\nTo start: What do you sell or what service do you provide?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hermesConfig, setHermesConfig] = useState<HermesConfig | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Hermes config + business from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('hermesConfig');
    if (savedConfig) {
      setHermesConfig(JSON.parse(savedConfig));
    } else {
      // Default suggestion for local Hermes
      setHermesConfig({
        baseUrl: 'http://localhost:8642',
        apiKey: 'change-me-local-dev'
      });
    }

    const savedBiz = localStorage.getItem('currentBusinessId');
    if (savedBiz) setBusinessId(savedBiz);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveHermesConfig = (config: HermesConfig) => {
    localStorage.setItem('hermesConfig', JSON.stringify(config));
    setHermesConfig(config);
    toast.success('Hermes connection saved');
  };

  async function createBusinessIfNeeded() {
    if (businessId) return businessId;

    // Create a placeholder business
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Business',
        description: 'Discovered via interview'
      })
    });
    const biz = await res.json();
    setBusinessId(biz.id);
    return biz.id;
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const config = hermesConfig;
      if (!config) {
        throw new Error("Please connect Hermes first (top right)");
      }

      // Call our proxy which talks to Hermes
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          // Strong business analyst system prompt
          system: `You are an expert Business Analyst for Hermes Forge.

Your job is to have a natural conversation while extracting the company's operating model.

Key areas to cover:
- What they sell / core offering
- Target customers & how they find you (acquisition)
- How work gets delivered (fulfillment)
- Tools and software they use today
- Repetitive manual tasks and time sinks
- Team structure and departments
- Goals and constraints

Keep responses concise and curious. Ask one focused follow-up at a time when needed.

After important revelations, you can note things like "[KEY: customer acquisition via LinkedIn ads]".

Do NOT mention n8n or automation yet — this is pure discovery.`
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to reach Hermes');
      }

      const data = await res.json();
      const assistantContent = data.content || "Thanks, noted.";

      const assistantMessage: Message = { role: 'assistant', content: assistantContent };
      const updated = [...newMessages, assistantMessage];
      setMessages(updated);

      // Trigger structured extraction (non-blocking for UX)
      const bizId = await createBusinessIfNeeded();
      extractKnowledge(bizId, updated).catch(console.error);

    } catch (error: any) {
      toast.error(error.message || 'Error talking to Hermes');
      // Remove the user message on failure
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  }

  async function extractKnowledge(bizId: string, conversation: Message[]) {
    try {
      const config = hermesConfig;
      if (!config) return;

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: bizId,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          conversation: conversation.slice(-6) // last few turns
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExtracted(result);
        if (result.processesCreated > 0) {
          toast.success(`Extracted ${result.processesCreated} process(es)`);
        }
      }
    } catch (e) {
      // Silent fail on extraction — not fatal
      console.warn('Extraction failed', e);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isConnected = !!hermesConfig;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div>
            <span className="font-semibold">Business Interview</span>
            <span className="ml-3 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">PHASE 1</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {isConnected ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> Hermes connected
            </div>
          ) : (
            <Link href="#connect" className="text-amber-400 hover:underline">Connect Hermes →</Link>
          )}
          <Link href="/dashboard" className="btn-secondary text-xs px-3 py-1.5">View Dashboard</Link>
        </div>
      </div>

      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Chat */}
        <div className="flex-1 flex flex-col border-r border-zinc-800">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`chat-message ${msg.role === 'user' 
                    ? 'bg-white text-black' 
                    : 'bg-zinc-900 border border-zinc-800'}`}
                >
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</div>
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

          {/* Input */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-950">
            {!isConnected && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                Connect to Hermes (or set a demo config) in the panel on the right.
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Tell me about your business..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="btn-primary"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] text-zinc-500 mt-2 px-1">
              Hermes will extract structured facts after each exchange. Be specific about customers, tools, and repeated work.
            </div>
          </div>
        </div>

        {/* Side panel: Live knowledge + connection */}
        <div className="w-80 flex flex-col p-5 gap-5 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-500 mb-2">
              <div>HERMES CONNECTION</div>
              <button 
                onClick={() => {
                  const url = prompt("Hermes API base URL", hermesConfig?.baseUrl || "http://localhost:8642");
                  const key = prompt("API Key", hermesConfig?.apiKey || "change-me-local-dev");
                  if (url && key) saveHermesConfig({ baseUrl: url, apiKey: key });
                }}
                className="text-emerald-400 hover:underline"
              >
                EDIT
              </button>
            </div>
            <div className="card p-3 text-xs font-mono space-y-1">
              <div>URL: <span className="text-emerald-400">{hermesConfig?.baseUrl || 'not set'}</span></div>
              <div>Key: <span className="text-zinc-400">{hermesConfig?.apiKey ? '••••••••' : 'not set'}</span></div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 mb-2">
              <Database className="w-3.5 h-3.5" /> LIVE KNOWLEDGE
            </div>
            {!extracted ? (
              <div className="text-xs text-zinc-500 p-3 border border-zinc-800 rounded-xl">
                Start the interview. Structured data will appear here as Hermes extracts it.
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {extracted.business && (
                  <div className="card p-3">
                    <div className="font-semibold mb-1 text-emerald-400 text-xs">BUSINESS</div>
                    <div>{extracted.business.name}</div>
                    <div className="text-xs text-zinc-400">{extracted.business.description}</div>
                  </div>
                )}
                {extracted.processes?.length > 0 && (
                  <div className="card p-3">
                    <div className="font-semibold mb-1.5 text-emerald-400 text-xs">PROCESSES ({extracted.processes.length})</div>
                    <ul className="space-y-1.5 text-xs">
                      {extracted.processes.slice(0, 5).map((p: any, i: number) => (
                        <li key={i} className="flex justify-between border-b border-zinc-800 pb-1 last:border-0">
                          <span>{p.name}</span>
                          <span className="text-emerald-400 tabular-nums">{p.automationScore}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 mt-auto">
            <Link href="/dashboard" className="btn-secondary w-full justify-center text-center flex items-center gap-2 text-sm py-2.5">
              <Target className="w-4 h-4" /> Go to full Dashboard
            </Link>
            <button 
              onClick={async () => {
                const res = await fetch('/api/seed', { method: 'POST' });
                if (res.ok) {
                  toast.success('Demo business + processes loaded');
                  window.location.href = '/dashboard';
                }
              }}
              className="w-full text-xs text-zinc-400 hover:text-white py-1"
            >
              Skip to demo data →
            </button>
            <div className="text-[10px] text-center text-zinc-500 mt-3">
              All insights are saved to structured memory.<br />No chat-only state.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
