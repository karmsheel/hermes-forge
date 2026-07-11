"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setActiveProcessId } from "@/lib/workshop-storage";
import { useForgeTabs, type OpenInNewTabSnapshot } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";

/**
 * Shell navigation that prefers desktop tabs when enabled (4.15).
 * Web falls back to Next.js router.
 */
export function useShellNavigate() {
  const router = useRouter();
  const { currentBusiness } = useShell();
  const tabs = useForgeTabs();

  const go = useCallback(
    (route: string) => {
      if (tabs.enabled) {
        tabs.navigateActiveTab(route);
        return;
      }
      router.push(route);
    },
    [router, tabs],
  );

  const openWorkshop = useCallback(
    (options?: {
      processId?: string | null;
      processName?: string | null;
      businessId?: string;
      businessName?: string;
      /** Force a new tab on desktop (Ctrl/meta click, context menu). */
      newTab?: boolean;
    }) => {
      const businessId = options?.businessId ?? currentBusiness?.id;
      const businessName =
        options?.businessName ?? currentBusiness?.name ?? "Business";
      const processId = options?.processId ?? undefined;

      if (businessId && processId) {
        setActiveProcessId(businessId, processId);
      }

      if (tabs.enabled) {
        const snapshot: OpenInNewTabSnapshot = {
          businessId: businessId ?? undefined,
          businessName,
          processId,
          processName: options?.processName,
        };
        if (options?.newTab) {
          const id = tabs.openInNewTab("/workshop", snapshot);
          if (!id) {
            toast.error("Could not open a new tab (limit reached?)");
          }
          return;
        }
        if (businessId) {
          tabs.updateActiveTab({
            businessId,
            businessName,
            processId,
            processName: options?.processName,
            route: "/workshop",
          });
        }
        tabs.navigateActiveTab("/workshop");
        return;
      }

      router.push("/workshop");
    },
    [currentBusiness, router, tabs],
  );

  const openBusinessHome = useCallback(
    async (options: {
      businessId: string;
      businessName: string;
      newTab?: boolean;
      switchAndEnter?: (id: string) => Promise<boolean>;
    }) => {
      const { businessId, businessName, newTab, switchAndEnter } = options;

      if (tabs.enabled && newTab) {
        const id = tabs.openInNewTab("/home", { businessId, businessName });
        if (!id) toast.error("Could not open a new tab (limit reached?)");
        return;
      }

      if (switchAndEnter) {
        const ok = await switchAndEnter(businessId);
        if (!ok) return;
      }

      if (tabs.enabled) {
        tabs.updateActiveTab({ businessId, businessName, route: "/home" });
        tabs.navigateActiveTab("/home");
        return;
      }

      router.push("/home");
    },
    [router, tabs],
  );

  return {
    enabled: tabs.enabled,
    go,
    openWorkshop,
    openBusinessHome,
    openInNewTab: tabs.openInNewTab,
  };
}
