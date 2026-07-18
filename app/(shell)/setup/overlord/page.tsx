"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OverlordSetup } from "@/components/overlord/OverlordSetup";

export default function OverlordSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <OverlordSetup />
    </Suspense>
  );
}
