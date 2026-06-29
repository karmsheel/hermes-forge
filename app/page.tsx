"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, Database, Target } from "lucide-react";
import type { UserProfile } from "@/lib/types";

export default function Landing() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .finally(() => setChecked(true));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
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
            {checked && user ? (
              <>
                <Link href="/projects" className="text-zinc-400 hover:text-white transition-colors">
                  Projects
                </Link>
                <Link href="/workshop" className="text-zinc-400 hover:text-white transition-colors">
                  Workshop
                </Link>
                <Link href="/projects" className="btn-primary text-sm">
                  Open App <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            ) : checked ? (
              <>
                <Link href="/login" className="text-zinc-400 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary text-sm">
                  Get started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1 text-xs tracking-[2px] text-zinc-400 mb-6">
          HERMES AGENT ACCELERATED BUSINESS HACKATHON
        </div>

        <h1 className="text-6xl font-semibold tracking-tighter leading-none mb-6">
          Describe your business.<br />Discover how it actually works.
        </h1>

        <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-10">
          Organize businesses as projects, map workflows with live diagrams, and chat with Hermes to build your operating model.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href={user ? "/projects" : "/signup"}
            className="btn-primary text-base px-8 py-3 rounded-xl flex items-center gap-3"
          >
            {user ? "Your Projects" : "Get Started"} <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href={user ? "/workshop" : "/login"} className="btn-secondary text-base px-6 py-3">
            {user ? "Open Workshop" : "Sign in"}
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Each account can own multiple projects — each with its own workflows and diagrams.
        </p>
      </div>

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
            <div className="font-semibold text-lg">Multi-Project Workspace</div>
            <div className="text-zinc-400 text-sm leading-relaxed">
              One login, many projects. Each keeps its own workflows, chat history, and diagrams.
            </div>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-lg">Automation Scoring</div>
            <div className="text-zinc-400 text-sm leading-relaxed">
              Every process gets a 0-100 automation score based on repetition, effort, business value, and complexity.
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-500">
        Built for the Hermes Agent + NVIDIA + Stripe Hackathon • Phase 1: Business Discovery Engine
      </div>
    </div>
  );
}