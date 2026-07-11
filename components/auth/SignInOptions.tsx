"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GitBranch, Loader2, Lock, Monitor } from "lucide-react";
import { toast } from "sonner";
import iconImage from "@/assets/icon.jpg";
import { isLocalUserEmail } from "@/lib/local-user";

export type SignInOptionsVariant = "page" | "profile";

interface SignInOptionsProps {
  /** Full-page chooser after Hermes connect, or embedded upgrade panel on Profile. */
  variant?: SignInOptionsVariant;
  /** Where to send the user after a successful local (or future) sign-in. */
  redirectTo?: string;
  /** Current session email — used on profile to mark the active method. */
  currentEmail?: string | null;
  /** Hide the brand header (profile embeds its own section title). */
  showBrand?: boolean;
}

export function SignInOptions({
  variant = "page",
  redirectTo = "/business-manager",
  currentEmail = null,
  showBrand,
}: SignInOptionsProps) {
  const router = useRouter();
  const [localLoading, setLocalLoading] = useState(false);
  const isPage = variant === "page";
  const brandVisible = showBrand ?? isPage;
  const localActive = isLocalUserEmail(currentEmail);
  const hasRemoteIdentity = Boolean(currentEmail && !localActive);

  async function handleLocalSignIn() {
    if (localActive && !isPage) {
      toast.message("You are already using local mode");
      return;
    }

    setLocalLoading(true);
    try {
      const res = await fetch("/api/auth/local", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not start local session");
      }

      toast.success("Continuing with local mode");
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLocalLoading(false);
    }
  }

  function handleComingSoon(label: string) {
    toast.message(`${label} is coming soon`, {
      description:
        "You can keep building locally and enable this later from Profile once your business is further along.",
    });
  }

  return (
    <div className={isPage ? "w-full max-w-md" : "w-full"}>
      {brandVisible && (
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <Image
              src={iconImage}
              alt="Hermes Forge"
              className="w-9 h-9 rounded-lg object-cover"
              width={36}
              height={36}
              priority={isPage}
            />
            <span className="font-semibold text-lg tracking-tight">Hermes Forge</span>
          </div>
          <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.35em] text-accent mb-4">
            Sign in
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">How do you want to continue?</h1>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            Hermes is connected. Choose how to identify yourself on this machine. You can stay local
            for now and add email or GitHub later from Profile.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleLocalSignIn()}
          disabled={localLoading}
          className="card w-full p-4 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-selected disabled:opacity-60"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              {localLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text">Use local or no sign-in</span>
                {localActive && (
                  <span className="rounded-full bg-green-bg px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-green">
                    Active
                  </span>
                )}
                {!localActive && isPage && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-accent">
                    Available
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">
                Stay on this machine with no account. Best for a quick start — data stays local to
                Hermes Forge on this device.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleComingSoon("Email sign-in")}
          className="card w-full p-4 text-left opacity-90 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-selected"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-text-muted">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text">Create email sign-in</span>
                {hasRemoteIdentity ? (
                  <span className="rounded-full bg-green-bg px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-green">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">
                Lock or encrypt access with an email and password when you want stronger protection
                for your businesses.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleComingSoon("GitHub sign-in")}
          className="card w-full p-4 text-left opacity-90 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-selected"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-text-muted">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text">GitHub login</span>
                <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber">
                  Coming soon
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">
                Sign in with GitHub to back up and sync businesses to a repo — pick up work on other
                machines, collaborate, and keep a full history over time.
              </p>
            </div>
          </div>
        </button>
      </div>

      <p className="text-xs text-text-soft mt-5 leading-relaxed text-center sm:text-left">
        Email and GitHub are optional. You can come back and sign in with those credentials later
        from Profile once your business is more developed — then lock data or push it to a GitHub
        repo for backup and traceability.
      </p>
    </div>
  );
}
