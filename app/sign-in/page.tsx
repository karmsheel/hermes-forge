"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignInOptions } from "@/components/auth/SignInOptions";
import { GatewayConnectingOverlay } from "@/components/hermes/GatewayConnectingOverlay";

function SignInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/business-manager";
  const oauthError = searchParams.get("error");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!oauthError) return;
    // Surface OAuth failures from /api/auth/github/callback redirects.
    toast.error(oauthError);
    // Strip error from URL so refresh does not re-toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [oauthError]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        // Stay on chooser when OAuth error is present so the user can retry.
        if (data?.user && !oauthError) {
          // Already signed in: prefer Overlord setup when unset
          const me = await fetch("/api/overlord")
            .then((r) => r.json())
            .catch(() => null);
          router.replace(me?.overlord?.profileKey ? redirectTo : "/setup/overlord");
          return;
        }
      } catch {
        /* show chooser */
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [redirectTo, router, oauthError]);

  if (checking) {
    return (
      <div className="app-shell flex items-center justify-center px-6">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="app-shell flex items-center justify-center px-6 py-12">
      <SignInOptions variant="page" redirectTo={redirectTo} />
    </div>
  );
}

/** Post-Hermes identity chooser — local + GitHub; email still later. */
export default function SignInPage() {
  return (
    <Suspense fallback={<GatewayConnectingOverlay />}>
      <SignInPageInner />
    </Suspense>
  );
}
