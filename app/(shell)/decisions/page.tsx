"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { useShell } from "@/components/shell/ShellContext";

export default function DecisionsPage() {
  const router = useRouter();
  const { hydrated, showDecisionsPage } = useDeveloperSettings();
  const { currentBusiness } = useShell();

  useEffect(() => {
    if (hydrated && !showDecisionsPage) {
      router.replace("/home");
    }
  }, [hydrated, showDecisionsPage, router]);

  if (!hydrated || !showDecisionsPage) {
    return null;
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
          Governance
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Decisions</h1>
        {currentBusiness && (
          <p className="text-sm text-accent mt-1">in {currentBusiness.name}</p>
        )}
        <p className="text-sm text-text-muted mt-3 max-w-2xl">
          A record of choices and commitments made by the business owner — linked
          to the business log for a complete historical trail.
        </p>
      </div>

      <div className="card p-10 text-center text-text-muted">
        <p className="text-sm">Decision recording is not available yet.</p>
        <p className="text-xs mt-2">
          Recorded decisions will appear here and in the{" "}
          <Link href="/log" className="text-accent hover:underline">
            business log
          </Link>
          .
        </p>
      </div>
    </main>
  );
}