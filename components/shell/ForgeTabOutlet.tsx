"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  WorkshopSession,
  type WorkshopSessionMeta,
} from "@/components/workshop/WorkshopSession";
import {
  FORGE_WORKSHOP_SOFT_MAX,
  formatTabTitle,
  normalizeShellRoute,
  selectLruUnloadTargets,
  type ForgeTab,
} from "@/lib/forge-tabs";
import { useForgeTabs } from "./ForgeTabProvider";
import { useShell } from "./ShellContext";

function isWorkshopRoute(route: string): boolean {
  return normalizeShellRoute(route).split("?")[0]!.startsWith("/workshop");
}

/**
 * Desktop multi-tab content outlet (4.15).
 * Keeps WorkshopSession instances mounted for workshop tabs (unless unloaded)
 * so chat/diagram streams continue in the background.
 */
export function ForgeTabOutlet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentBusiness } = useShell();
  const {
    enabled,
    tabs,
    activeTabId,
    activeTab,
    updateTab,
    unloadedSessionIds,
    lastActivatedAt,
    unloadSession,
  } = useForgeTabs();

  // Once a tab visits workshop, keep its session mounted until closed or unloaded
  const [visitedWorkshopIds, setVisitedWorkshopIds] = useState<Set<string>>(() => new Set());
  const warnedUnloadRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    setVisitedWorkshopIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of next) {
        if (!tabs.some((t) => t.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      for (const tab of tabs) {
        if (isWorkshopRoute(tab.route) && !next.has(tab.id)) {
          next.add(tab.id);
          changed = true;
        }
      }
      if (
        activeTabId &&
        (pathname.startsWith("/workshop") ||
          (activeTab && isWorkshopRoute(activeTab.route))) &&
        !next.has(activeTabId)
      ) {
        next.add(activeTabId);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [enabled, tabs, activeTabId, activeTab, pathname]);

  const workshopTabs = useMemo(() => {
    if (!enabled) return [] as ForgeTab[];
    const ids = new Set(visitedWorkshopIds);
    for (const tab of tabs) {
      if (isWorkshopRoute(tab.route)) ids.add(tab.id);
    }
    if (
      activeTabId &&
      (pathname.startsWith("/workshop") ||
        (activeTab && isWorkshopRoute(activeTab.route)))
    ) {
      ids.add(activeTabId);
    }
    return tabs.filter((t) => ids.has(t.id));
  }, [enabled, tabs, visitedWorkshopIds, activeTabId, activeTab, pathname]);

  const mountedWorkshopTabs = useMemo(
    () => workshopTabs.filter((t) => !unloadedSessionIds.includes(t.id)),
    [workshopTabs, unloadedSessionIds],
  );

  // Memory guard: unload LRU inactive workshop sessions beyond soft max
  useEffect(() => {
    if (!enabled) return;
    const candidates = mountedWorkshopTabs.map((t) => ({
      id: t.id,
      lastActivated: lastActivatedAt[t.id] ?? 0,
    }));
    const targets = selectLruUnloadTargets(
      candidates,
      activeTabId,
      FORGE_WORKSHOP_SOFT_MAX,
    );
    if (targets.length === 0) {
      warnedUnloadRef.current = false;
      return;
    }
    for (const id of targets) {
      unloadSession(id);
    }
    if (!warnedUnloadRef.current) {
      warnedUnloadRef.current = true;
      toast.message("Unloaded inactive workshop sessions", {
        description: `Keeping up to ${FORGE_WORKSHOP_SOFT_MAX} live workshops. Activate a tab to remount.`,
      });
    }
  }, [
    enabled,
    mountedWorkshopTabs,
    activeTabId,
    lastActivatedAt,
    unloadSession,
  ]);

  const handleMetaChange = useCallback(
    (tabId: string, meta: WorkshopSessionMeta) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const processId =
        meta.processId === undefined ? tab.processId : meta.processId ?? undefined;
      const processName =
        meta.processName === undefined ? undefined : meta.processName;
      const workspaceTab =
        meta.workspaceTab === undefined ? tab.workspaceTab : meta.workspaceTab;
      updateTab(tabId, {
        processId,
        workspaceTab,
        title: formatTabTitle(tab.businessName, tab.route, processName ?? null),
      });
    },
    [tabs, updateTab],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  const activeIsWorkshop =
    (activeTab && isWorkshopRoute(activeTab.route)) ||
    pathname.startsWith("/workshop");

  return (
    <div className="forge-tab-outlet">
      {mountedWorkshopTabs.map((tab) => {
        const isActive = tab.id === activeTabId && activeIsWorkshop;
        const bizId = tab.businessId || currentBusiness?.id;
        const bizName = tab.businessName || currentBusiness?.name || "Business";
        if (!bizId) return null;

        return (
          <div
            key={tab.id}
            className={`forge-tab-pane${isActive ? " is-active" : " is-inactive"}`}
            aria-hidden={!isActive}
            data-tab-id={tab.id}
          >
            <WorkshopSession
              tabId={tab.id}
              businessId={bizId}
              businessName={bizName}
              initialProcessId={tab.processId ?? null}
              initialWorkspaceTab={tab.workspaceTab}
              isActive={isActive}
              onMetaChange={(meta) => handleMetaChange(tab.id, meta)}
            />
          </div>
        );
      })}

      {!activeIsWorkshop ? (
        <div className="forge-tab-pane is-active forge-tab-pane--route">{children}</div>
      ) : mountedWorkshopTabs.length === 0 ? (
        <div className="forge-tab-pane is-active forge-tab-pane--route">
          {activeTab && unloadedSessionIds.includes(activeTab.id) ? (
            <div className="h-full min-h-0 flex items-center justify-center text-text-muted text-sm p-8">
              Remounting workshop session…
            </div>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}
