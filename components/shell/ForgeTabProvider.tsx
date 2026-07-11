"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { isForgeDesktop } from "@/lib/forge-desktop";
import {
  FORGE_TABS_MAX,
  buildTab,
  formatTabTitle,
  loadForgeTabsState,
  normalizeShellRoute,
  reorderByIndex,
  saveForgeTabsState,
  type ForgeTab,
} from "@/lib/forge-tabs";
import { useShell } from "./ShellContext";

export type OpenInNewTabSnapshot = Partial<
  Pick<
    ForgeTab,
    | "businessId"
    | "businessName"
    | "processId"
    | "workspaceTab"
    | "automationProcessId"
    | "title"
  >
> & {
  processName?: string | null;
};

type ForgeTabsContextValue = {
  /** True only on Electron desktop after hydration. */
  enabled: boolean;
  tabs: ForgeTab[];
  activeTabId: string | null;
  activeTab: ForgeTab | null;
  /** Workshop session ids currently unloaded (not multi-mounted). */
  unloadedSessionIds: readonly string[];
  /** Last-activated timestamp per tab id (for LRU unload). */
  lastActivatedAt: Readonly<Record<string, number>>;
  createTab: (partial?: OpenInNewTabSnapshot & { route?: string }) => string | null;
  closeTab: (id: string) => void;
  closeOtherTabs: (keepId: string) => void;
  duplicateTab: (id: string) => string | null;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  activateTab: (id: string) => void;
  updateActiveTab: (patch: Partial<ForgeTab> & { processName?: string | null }) => void;
  updateTab: (id: string, patch: Partial<ForgeTab> & { processName?: string | null }) => void;
  openInNewTab: (route: string, snapshot?: OpenInNewTabSnapshot) => string | null;
  navigateActiveTab: (route: string) => void;
  unloadSession: (id: string) => void;
  reloadSession: (id: string) => void;
  isSessionUnloaded: (id: string) => boolean;
};

const ForgeTabsContext = createContext<ForgeTabsContextValue | null>(null);

const DISABLED: ForgeTabsContextValue = {
  enabled: false,
  tabs: [],
  activeTabId: null,
  activeTab: null,
  unloadedSessionIds: [],
  lastActivatedAt: {},
  createTab: () => null,
  closeTab: () => {},
  closeOtherTabs: () => {},
  duplicateTab: () => null,
  reorderTabs: () => {},
  activateTab: () => {},
  updateActiveTab: () => {},
  updateTab: () => {},
  openInNewTab: () => null,
  navigateActiveTab: () => {},
  unloadSession: () => {},
  reloadSession: () => {},
  isSessionUnloaded: () => false,
};

function applyTabPatch(
  tab: ForgeTab,
  patch: Partial<ForgeTab> & { processName?: string | null },
): ForgeTab {
  const next: ForgeTab = {
    ...tab,
    ...patch,
    id: tab.id,
  };
  if (patch.route) {
    next.route = normalizeShellRoute(patch.route);
  }
  const processName =
    patch.processName !== undefined
      ? patch.processName
      : patch.title
        ? undefined
        : undefined;
  if (patch.title) {
    next.title = patch.title;
  } else if (
    patch.businessName !== undefined ||
    patch.route !== undefined ||
    patch.processName !== undefined
  ) {
    next.title = formatTabTitle(
      next.businessName,
      next.route,
      processName ?? null,
    );
  }
  return next;
}

export function ForgeTabProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentBusiness, switchBusiness, userLoading } = useShell();

  const [desktop, setDesktop] = useState(false);
  const [tabs, setTabs] = useState<ForgeTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [unloadedSessionIds, setUnloadedSessionIds] = useState<string[]>([]);
  const [lastActivatedAt, setLastActivatedAt] = useState<Record<string, number>>({});

  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const switchingRef = useRef(false);
  const seededRef = useRef(false);
  const activationSeqRef = useRef(0);

  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;

  const touchActivation = useCallback((id: string) => {
    activationSeqRef.current += 1;
    const stamp = activationSeqRef.current;
    setLastActivatedAt((prev) => ({ ...prev, [id]: stamp }));
  }, []);

  useEffect(() => {
    setDesktop(isForgeDesktop());
  }, []);

  const enabled = desktop && hydrated;

  const persist = useCallback((nextTabs: ForgeTab[], nextActive: string) => {
    saveForgeTabsState({ tabs: nextTabs, activeTabId: nextActive });
  }, []);

  // Seed / restore once shell business is known
  useEffect(() => {
    if (!desktop || userLoading) return;
    if (!currentBusiness) {
      // No business yet — hide tab bar until one exists; allow re-seed later
      setHydrated(true);
      return;
    }
    if (seededRef.current) return;

    seededRef.current = true;
    const route = normalizeShellRoute(pathname || "/home");
    const stored = loadForgeTabsState();

    if (stored && stored.tabs.length > 0) {
      setTabs(stored.tabs);
      setActiveTabId(stored.activeTabId);
      const active = stored.tabs.find((t) => t.id === stored.activeTabId) ?? stored.tabs[0]!;
      touchActivation(active.id);
      // Align visible route with active tab if needed
      if (normalizeShellRoute(pathname || "/home") !== normalizeShellRoute(active.route)) {
        switchingRef.current = true;
        router.replace(active.route);
        queueMicrotask(() => {
          switchingRef.current = false;
        });
      }
      if (active.businessId !== currentBusiness.id) {
        void switchBusiness(active.businessId);
      }
    } else {
      const seed = buildTab({
        route,
        businessId: currentBusiness.id,
        businessName: currentBusiness.name,
      });
      setTabs([seed]);
      setActiveTabId(seed.id);
      touchActivation(seed.id);
      persist([seed], seed.id);
    }

    setHydrated(true);
  }, [desktop, userLoading, currentBusiness, pathname, router, switchBusiness, persist, touchActivation]);

  // Keep active tab route in sync with Next navigation (in-page links, etc.)
  useEffect(() => {
    if (!enabled || !activeTabId || switchingRef.current) return;
    const route = normalizeShellRoute(pathname || "/home");
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === activeTabId);
      if (idx < 0) return prev;
      const current = prev[idx]!;
      if (normalizeShellRoute(current.route) === route) return prev;
      const next = [...prev];
      next[idx] = applyTabPatch(current, {
        route,
        businessName: currentBusiness?.name ?? current.businessName,
        businessId: currentBusiness?.id ?? current.businessId,
      });
      persist(next, activeTabId);
      return next;
    });
  }, [pathname, enabled, activeTabId, currentBusiness, persist]);

  // When shell business changes (switcher), patch active tab
  useEffect(() => {
    if (!enabled || !activeTabId || !currentBusiness || switchingRef.current) return;
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === activeTabId);
      if (idx < 0) return prev;
      const current = prev[idx]!;
      if (
        current.businessId === currentBusiness.id &&
        current.businessName === currentBusiness.name
      ) {
        return prev;
      }
      const next = [...prev];
      next[idx] = applyTabPatch(current, {
        businessId: currentBusiness.id,
        businessName: currentBusiness.name,
      });
      persist(next, activeTabId);
      return next;
    });
  }, [currentBusiness, enabled, activeTabId, persist]);

  const reloadSession = useCallback((id: string) => {
    setUnloadedSessionIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const unloadSession = useCallback(
    (id: string) => {
      if (id === activeTabIdRef.current) return;
      setUnloadedSessionIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [],
  );

  const isSessionUnloaded = useCallback(
    (id: string) => unloadedSessionIds.includes(id),
    [unloadedSessionIds],
  );

  const activateTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (!tab) return;
      setActiveTabId(id);
      touchActivation(id);
      // Remount unloaded workshop sessions when brought forward
      reloadSession(id);
      persist(tabsRef.current, id);
      switchingRef.current = true;
      const go = async () => {
        try {
          if (currentBusiness?.id !== tab.businessId) {
            await switchBusiness(tab.businessId);
          }
          if (normalizeShellRoute(pathname || "/home") !== normalizeShellRoute(tab.route)) {
            router.push(tab.route);
          }
        } finally {
          // Allow pathname sync after navigation settles
          window.setTimeout(() => {
            switchingRef.current = false;
          }, 50);
        }
      };
      void go();
    },
    [currentBusiness?.id, pathname, persist, reloadSession, router, switchBusiness, touchActivation],
  );

  const navigateActiveTab = useCallback(
    (route: string) => {
      const id = activeTabIdRef.current;
      if (!id) {
        router.push(route);
        return;
      }
      const normalized = normalizeShellRoute(route);
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = applyTabPatch(prev[idx]!, {
          route: normalized,
          businessId: currentBusiness?.id ?? prev[idx]!.businessId,
          businessName: currentBusiness?.name ?? prev[idx]!.businessName,
        });
        persist(next, id);
        return next;
      });
      switchingRef.current = true;
      router.push(normalized);
      window.setTimeout(() => {
        switchingRef.current = false;
      }, 50);
    },
    [currentBusiness?.id, currentBusiness?.name, persist, router],
  );

  const createTab = useCallback(
    (partial?: OpenInNewTabSnapshot & { route?: string }): string | null => {
      if (!currentBusiness && !partial?.businessId) return null;
      if (tabsRef.current.length >= FORGE_TABS_MAX) {
        toast.warning(`Tab limit reached (${FORGE_TABS_MAX}). Close a tab to open another.`);
        return null;
      }

      const active = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
      const route = normalizeShellRoute(
        partial?.route ?? active?.route ?? pathname ?? "/home",
      );
      const businessId = partial?.businessId ?? currentBusiness?.id ?? active?.businessId;
      const businessName =
        partial?.businessName ?? currentBusiness?.name ?? active?.businessName ?? "Business";
      if (!businessId) return null;

      const tab = buildTab({
        route,
        businessId,
        businessName,
        processId: partial?.processId ?? active?.processId,
        processName: partial?.processName,
        workspaceTab: partial?.workspaceTab ?? active?.workspaceTab,
        automationProcessId: partial?.automationProcessId ?? active?.automationProcessId,
        title: partial?.title,
      });

      const nextTabs = [...tabsRef.current, tab];
      setTabs(nextTabs);
      setActiveTabId(tab.id);
      touchActivation(tab.id);
      persist(nextTabs, tab.id);

      switchingRef.current = true;
      void (async () => {
        try {
          if (currentBusiness?.id !== tab.businessId) {
            await switchBusiness(tab.businessId);
          }
          if (normalizeShellRoute(pathname || "/home") !== normalizeShellRoute(tab.route)) {
            router.push(tab.route);
          }
        } finally {
          window.setTimeout(() => {
            switchingRef.current = false;
          }, 50);
        }
      })();

      return tab.id;
    },
    [currentBusiness, pathname, persist, router, switchBusiness, touchActivation],
  );

  const openInNewTab = useCallback(
    (route: string, snapshot?: OpenInNewTabSnapshot) => {
      return createTab({ ...snapshot, route });
    },
    [createTab],
  );

  const duplicateTab = useCallback(
    (id: string) => {
      const source = tabsRef.current.find((t) => t.id === id);
      if (!source) return null;
      return createTab({
        route: source.route,
        businessId: source.businessId,
        businessName: source.businessName,
        processId: source.processId,
        workspaceTab: source.workspaceTab,
        automationProcessId: source.automationProcessId,
        title: source.title,
      });
    },
    [createTab],
  );

  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      const prev = tabsRef.current;
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return;
      }
      const next = reorderByIndex(prev, fromIndex, toIndex);
      setTabs(next);
      const active = activeTabIdRef.current ?? next[0]?.id;
      if (active) persist(next, active);
    },
    [persist],
  );

  const closeTab = useCallback(
    (id: string) => {
      const prev = tabsRef.current;
      if (prev.length <= 1) return;
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const nextTabs = prev.filter((t) => t.id !== id);
      let nextActive = activeTabIdRef.current;
      if (nextActive === id) {
        const neighbor = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0]!;
        nextActive = neighbor.id;
      }
      setTabs(nextTabs);
      setActiveTabId(nextActive);
      setUnloadedSessionIds((u) => u.filter((x) => x !== id));
      if (nextActive) touchActivation(nextActive);
      persist(nextTabs, nextActive!);

      if (nextActive !== activeTabIdRef.current) {
        const tab = nextTabs.find((t) => t.id === nextActive);
        if (tab) {
          switchingRef.current = true;
          void (async () => {
            try {
              if (currentBusiness?.id !== tab.businessId) {
                await switchBusiness(tab.businessId);
              }
              router.push(tab.route);
            } finally {
              window.setTimeout(() => {
                switchingRef.current = false;
              }, 50);
            }
          })();
        }
      }
    },
    [currentBusiness?.id, persist, router, switchBusiness, touchActivation],
  );

  const closeOtherTabs = useCallback(
    (keepId: string) => {
      const keep = tabsRef.current.find((t) => t.id === keepId);
      if (!keep || tabsRef.current.length <= 1) return;
      const nextTabs = [keep];
      setTabs(nextTabs);
      setActiveTabId(keepId);
      setUnloadedSessionIds((u) => u.filter((x) => x === keepId));
      touchActivation(keepId);
      persist(nextTabs, keepId);
      if (activeTabIdRef.current !== keepId) {
        switchingRef.current = true;
        void (async () => {
          try {
            if (currentBusiness?.id !== keep.businessId) {
              await switchBusiness(keep.businessId);
            }
            router.push(keep.route);
          } finally {
            window.setTimeout(() => {
              switchingRef.current = false;
            }, 50);
          }
        })();
      }
    },
    [currentBusiness?.id, persist, router, switchBusiness, touchActivation],
  );

  const updateTab = useCallback(
    (id: string, patch: Partial<ForgeTab> & { processName?: string | null }) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = applyTabPatch(prev[idx]!, patch);
        const active = activeTabIdRef.current ?? next[0]!.id;
        persist(next, active);
        return next;
      });
    },
    [persist],
  );

  const updateActiveTab = useCallback(
    (patch: Partial<ForgeTab> & { processName?: string | null }) => {
      const id = activeTabIdRef.current;
      if (!id) return;
      updateTab(id, patch);
    },
    [updateTab],
  );

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if (e.key === "t" || e.key === "T") {
        if (inField) return;
        e.preventDefault();
        createTab();
        return;
      }
      if (e.key === "w" || e.key === "W") {
        if (inField) return;
        e.preventDefault();
        if (activeTabIdRef.current) closeTab(activeTabIdRef.current);
        return;
      }
      if (e.key === "Tab") {
        if (tabsRef.current.length < 2) return;
        e.preventDefault();
        const list = tabsRef.current;
        const idx = list.findIndex((t) => t.id === activeTabIdRef.current);
        const nextIdx = e.shiftKey
          ? (idx - 1 + list.length) % list.length
          : (idx + 1) % list.length;
        activateTab(list[nextIdx]!.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, createTab, closeTab, activateTab]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const value = useMemo<ForgeTabsContextValue>(() => {
    if (!enabled) return DISABLED;
    return {
      enabled: true,
      tabs,
      activeTabId,
      activeTab,
      unloadedSessionIds,
      lastActivatedAt,
      createTab,
      closeTab,
      closeOtherTabs,
      duplicateTab,
      reorderTabs,
      activateTab,
      updateActiveTab,
      updateTab,
      openInNewTab,
      navigateActiveTab,
      unloadSession,
      reloadSession,
      isSessionUnloaded,
    };
  }, [
    enabled,
    tabs,
    activeTabId,
    activeTab,
    unloadedSessionIds,
    lastActivatedAt,
    createTab,
    closeTab,
    closeOtherTabs,
    duplicateTab,
    reorderTabs,
    activateTab,
    updateActiveTab,
    updateTab,
    openInNewTab,
    navigateActiveTab,
    unloadSession,
    reloadSession,
    isSessionUnloaded,
  ]);

  return <ForgeTabsContext.Provider value={value}>{children}</ForgeTabsContext.Provider>;
}

export function useForgeTabs(): ForgeTabsContextValue {
  const ctx = useContext(ForgeTabsContext);
  if (!ctx) {
    // Allow components outside provider (tests / rare trees) to degrade
    return DISABLED;
  }
  return ctx;
}
