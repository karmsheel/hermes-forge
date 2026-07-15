"use client";

import { WorkshopSession } from "@/components/workshop/WorkshopSession";
import { useForgeTabs } from "@/components/shell/ForgeTabProvider";
import { useShell } from "@/components/shell/ShellContext";

/**
 * Workshop route.
 * - Web / single-session: renders one WorkshopSession from shell business.
 * - Desktop multi-tab (4.15): ForgeTabOutlet multi-mounts sessions; this page
 *   is only a Next.js route placeholder so navigation can land on /workshop.
 */
export default function WorkshopPage() {
  const { enabled: tabsEnabled } = useForgeTabs();
  const { currentBusiness, userLoading } = useShell();

  if (tabsEnabled) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center text-text-muted text-sm p-8">
        {/* Outlet owns workshop mounts; keep a minimal fallback if none yet. */}
        Loading workshop sessions…
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center text-text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center p-8 gap-2">
        <p className="text-text-muted text-sm">Select or create a business to open the workshop.</p>
      </div>
    );
  }

  return <WorkshopSession businessId={currentBusiness.id} isActive />;
}
