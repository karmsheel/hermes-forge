"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle, Database, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-black font-bold text-xl tracking-[-1px]">H</span>
            </div>
            <div>
              <div className="font-semibold tracking-tight">Hermes Forge</div>
              <div className="text-[10px] text-zinc-500 -mt-1">PHASE 1 • DISCOVERY</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/workshop" className="text-zinc-400 hover:text-white transition-colors">Workshop</Link>
            <Link 
              href="/workshop" 
              className="btn-primary text-sm"
            >
              Open Workshop <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1 text-xs tracking-[2px] text-zinc-400 mb-6">
          HERMES AGENT ACCELERATED BUSINESS HACKATHON
        </div>

        <h1 className="text-6xl font-semibold tracking-tighter leading-none mb-6">
          Describe your business.<br />Discover how it actually works.
        </h1>
        
        <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-10">
          Hermes Forge turns conversation into a structured model of your business — 
          departments, processes, and clear automation opportunities.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/workshop" 
            className="btn-primary text-base px-8 py-3 rounded-xl flex items-center gap-3"
          >
            Open Process Workshop <ArrowRight className="w-5 h-5" />
          </Link>
          <Link 
            href="/dashboard" 
            className="btn-secondary text-base px-6 py-3"
          >
            View Demo Dashboard
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Phase 1: Pure discovery. No workflows yet. Structured knowledge is the foundation.
        </p>
      </div>

      {/* Value props */}
      <div className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-lg">Live Process Diagrams</div>
            <div className="text-zinc-400 text-sm leading-relaxed">
              Chat with Hermes on the right while a Mermaid diagram builds in the center — correct it as you go.
            </div>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-lg">Structured Knowledge</div>
            <div className="text-zinc-400 text-sm leading-relaxed">
              Every insight becomes typed data: Business profile + Processes with triggers, steps, and inputs/outputs.
              Not just chat history.
            </div>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-lg">Automation Scoring</div>
            <div className="text-zinc-400 text-sm leading-relaxed">
              Every process gets a 0-100 automation score based on repetition, effort, business value, and complexity.
              Human approves everything.
            </div>
          </div>
        </div>
      </div>

      {/* Principles */}
      <div className="max-w-5xl mx-auto px-6 py-12 border-t border-zinc-800">
        <div className="text-xs tracking-[2px] text-zinc-500 mb-4">CORE PRINCIPLES</div>
        <div className="grid md:grid-cols-5 gap-x-8 gap-y-6 text-sm text-zinc-400">
          <div><span className="text-white font-medium">AI First</span> — Conversation, not drag-and-drop.</div>
          <div><span className="text-white font-medium">Human Approval</span> — Never auto-deploys.</div>
          <div><span className="text-white font-medium">Structured Memory</span> — DB is source of truth.</div>
          <div><span className="text-white font-medium">Incremental</span> — Every chat improves the model.</div>
          <div><span className="text-white font-medium">Execution Separation</span> — Hermes reasons. n8n executes (Phase 4+).</div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-500">
        Built for the Hermes Agent + NVIDIA + Stripe Hackathon • Phase 1: Business Discovery Engine
      </div>
    </div>
  );
}
