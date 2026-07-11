"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SignInOptions } from "@/components/auth/SignInOptions";
import { GatewayConnectingOverlay } from "@/components/hermes/GatewayConnectingOverlay";

function SignInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/business-manager";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.user) {
          router.replace(redirectTo);
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
  }, [redirectTo, router]);

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

/** Post-Hermes identity chooser — local now; email + GitHub later. */
export default function SignInPage() {
  return (
    <Suspense fallback={<GatewayConnectingOverlay />}>
      <SignInPageInner />
    </Suspense>
  );
}
