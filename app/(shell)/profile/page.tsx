"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";

/**
 * Deep-link / refresh entry for Profile.
 * Opens the shell-level Profile overlay (same pattern as /settings) then
 * returns to the previous route so the studio stays underneath.
 */
export default function ProfileRoutePage() {
  const router = useRouter();
  const { openProfile } = useShell();

  useEffect(() => {
    openProfile();

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/home");
  }, [openProfile, router]);

  return null;
}
