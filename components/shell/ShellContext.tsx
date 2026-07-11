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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HermesConnectionDialog } from "@/components/hermes/HermesConnectionDialog";
import { NewBusinessDialog } from "@/components/projects/NewBusinessDialog";
import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { DEFAULT_SETTINGS_VIEW, type SettingsViewId } from "@/lib/settings-views";

import { clearLegacyActiveProcessId, setPendingNewProcess } from "@/lib/workshop-storage";
import type { NewBusinessInput } from "@/lib/new-business";
import type { ActiveBusiness, UserProfile } from "@/lib/types";

function toActiveBusiness(
  business: {
    id: string;
    name: string;
    avatarEmoji?: string | null;
    avatarIcon?: string | null;
  } | null | undefined,
): ActiveBusiness | null {
  if (!business?.id || !business?.name) return null;
  return {
    id: business.id,
    name: business.name,
    avatarEmoji: business.avatarEmoji ?? null,
    avatarIcon: business.avatarIcon ?? null,
  };
}

interface ShellContextValue {
  user: UserProfile | null;
  userLoading: boolean;
  currentBusiness: ActiveBusiness | null;
  newBusinessOpen: boolean;
  connectionOpen: boolean;
  settingsOpen: boolean;
  settingsTab: SettingsViewId;
  creatingBusiness: boolean;
  openNewBusiness: () => void;
  closeNewBusiness: () => void;
  /** @deprecated Use openNewBusiness */
  openNewProject: () => void;
  /** @deprecated Use closeNewBusiness */
  closeNewProject: () => void;
  openHermesConnection: () => void;
  closeHermesConnection: () => void;
  openSettings: (tab?: SettingsViewId) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsViewId) => void;
  switchBusiness: (id: string) => Promise<boolean>;
  refreshCurrentBusiness: () => Promise<void>;
  createBusiness: (input: NewBusinessInput) => Promise<void>;
  requestNewProcess: () => void;
  registerWorkshopNewProcess: (handler: (() => void | Promise<void>) | null) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [currentBusiness, setCurrentBusiness] = useState<ActiveBusiness | null>(null);
  const [newBusinessOpen, setNewBusinessOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTabState] = useState<SettingsViewId>(DEFAULT_SETTINGS_VIEW);
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const workshopNewProcessRef = useRef<(() => void | Promise<void>) | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        // Do not silently create a local session — identity is chosen on /sign-in.
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data?.user) setUser(data.user);
        setCurrentBusiness(toActiveBusiness(data?.activeBusiness));
      } catch {
        /* ignore */
      } finally {
        setUserLoading(false);
      }
    }

    void loadUser();
  }, []);

  const refreshCurrentBusiness = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setCurrentBusiness(toActiveBusiness(me?.activeBusiness));
    } catch {
      /* non-fatal */
    }
  }, []);

  const createBusiness = useCallback(
    async ({ name, description, avatarEmoji, avatarIcon }: NewBusinessInput) => {
      setCreatingBusiness(true);
      try {
        const res = await fetch("/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            avatarEmoji: avatarEmoji || undefined,
            avatarIcon: avatarIcon || undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
        const business = await res.json();
        clearLegacyActiveProcessId();
        setNewBusinessOpen(false);
        const active = toActiveBusiness(business);
        if (active) {
          setCurrentBusiness(active);
        } else {
          await refreshCurrentBusiness();
        }
        // First-run for this business: force hire of a chatbar agent
        router.push("/personnel/hire?required=1");
      } catch {
        toast.error("Could not create business");
      } finally {
        setCreatingBusiness(false);
      }
    },
    [router, refreshCurrentBusiness]
  );

  const switchBusiness = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/businesses/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: id }),
        });
        if (!res.ok) throw new Error("Failed");
        clearLegacyActiveProcessId();
        await refreshCurrentBusiness();
        router.refresh();
        return true;
      } catch {
        toast.error("Could not switch business");
        return false;
      }
    },
    [router, refreshCurrentBusiness]
  );

  const registerWorkshopNewProcess = useCallback(
    (handler: (() => void | Promise<void>) | null) => {
      workshopNewProcessRef.current = handler;
    },
    []
  );

  const requestNewProcess = useCallback(() => {
    if (workshopNewProcessRef.current) {
      void workshopNewProcessRef.current();
      return;
    }
    setPendingNewProcess();
    router.push("/workshop");
  }, [router]);

  const openNewBusiness = useCallback(() => setNewBusinessOpen(true), []);
  const closeNewBusiness = useCallback(() => setNewBusinessOpen(false), []);

  const value = useMemo(
    () => ({
      user,
      userLoading,
      currentBusiness,
      newBusinessOpen,
      connectionOpen,
      settingsOpen,
      settingsTab,
      creatingBusiness,
      openNewBusiness,
      closeNewBusiness,
      openNewProject: openNewBusiness,
      closeNewProject: closeNewBusiness,
      openHermesConnection: () => setConnectionOpen(true),
      closeHermesConnection: () => setConnectionOpen(false),
      openSettings: (tab?: SettingsViewId) => {
        setSettingsTabState(tab ?? DEFAULT_SETTINGS_VIEW);
        setSettingsOpen(true);
      },
      closeSettings: () => setSettingsOpen(false),
      setSettingsTab: setSettingsTabState,
      switchBusiness,
      refreshCurrentBusiness,
      createBusiness,
      requestNewProcess,
      registerWorkshopNewProcess,
    }),
    [user, userLoading, currentBusiness, newBusinessOpen, connectionOpen, settingsOpen, settingsTab, creatingBusiness, openNewBusiness, closeNewBusiness, createBusiness, requestNewProcess, registerWorkshopNewProcess, switchBusiness, refreshCurrentBusiness]
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <NewBusinessDialog
        open={newBusinessOpen}
        creating={creatingBusiness}
        onClose={() => setNewBusinessOpen(false)}
        onCreate={createBusiness}
      />
      <HermesConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
      <SettingsOverlay
        open={settingsOpen}
        activeView={settingsTab}
        onViewChange={setSettingsTabState}
        onClose={() => setSettingsOpen(false)}
      />
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}