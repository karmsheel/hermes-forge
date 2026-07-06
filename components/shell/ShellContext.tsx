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
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { DEFAULT_SETTINGS_VIEW, type SettingsViewId } from "@/lib/settings-views";

import { clearLegacyActiveProcessId, setPendingNewProcess } from "@/lib/workshop-storage";
import type { UserProfile } from "@/lib/types";

interface ShellContextValue {
  user: UserProfile | null;
  userLoading: boolean;
  currentBusiness: { id: string; name: string } | null;
  newProjectOpen: boolean;
  connectionOpen: boolean;
  settingsOpen: boolean;
  settingsTab: SettingsViewId;
  creatingProject: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;
  openHermesConnection: () => void;
  closeHermesConnection: () => void;
  openSettings: (tab?: SettingsViewId) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsViewId) => void;
  switchBusiness: (id: string) => Promise<boolean>;
  refreshCurrentBusiness: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<void>;
  requestNewProcess: () => void;
  registerWorkshopNewProcess: (handler: (() => void | Promise<void>) | null) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [currentBusiness, setCurrentBusiness] = useState<{ id: string; name: string } | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTabState] = useState<SettingsViewId>(DEFAULT_SETTINGS_VIEW);
  const [creatingProject, setCreatingProject] = useState(false);
  const workshopNewProcessRef = useRef<(() => void | Promise<void>) | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        let res = await fetch("/api/auth/me");
        let data = await res.json();
        if (!data?.user) {
          await fetch("/api/auth/local", { method: "POST" });
          res = await fetch("/api/auth/me");
          data = await res.json();
        }
        if (data?.user) setUser(data.user);
        if (data?.activeBusiness) {
          setCurrentBusiness({ id: data.activeBusiness.id, name: data.activeBusiness.name });
        }
      } catch {
        /* ignore */
      } finally {
        setUserLoading(false);
      }
    }

    void loadUser();
  }, []);

  const createProject = useCallback(
    async (name: string, description: string) => {
      setCreatingProject(true);
      try {
        const res = await fetch("/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: description || undefined }),
        });
        if (!res.ok) throw new Error("Failed to create");
        clearLegacyActiveProcessId();
        setNewProjectOpen(false);
        router.push("/workshop");
      } catch {
        toast.error("Could not create business");
      } finally {
        setCreatingProject(false);
      }
    },
    [router]
  );

  const refreshCurrentBusiness = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (me?.activeBusiness) {
        setCurrentBusiness({ id: me.activeBusiness.id, name: me.activeBusiness.name });
      } else {
        setCurrentBusiness(null);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

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

  const value = useMemo(
    () => ({
      user,
      userLoading,
      currentBusiness,
      newProjectOpen,
      connectionOpen,
      settingsOpen,
      settingsTab,
      creatingProject,
      openNewProject: () => setNewProjectOpen(true),
      closeNewProject: () => setNewProjectOpen(false),
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
      createProject,
      requestNewProcess,
      registerWorkshopNewProcess,
    }),
    [user, userLoading, currentBusiness, newProjectOpen, connectionOpen, settingsOpen, settingsTab, creatingProject, createProject, requestNewProcess, registerWorkshopNewProcess, switchBusiness, refreshCurrentBusiness]
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <NewProjectDialog
        open={newProjectOpen}
        creating={creatingProject}
        onClose={() => setNewProjectOpen(false)}
        onCreate={createProject}
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