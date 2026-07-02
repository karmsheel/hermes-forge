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
import { BusinessSwitcherDialog } from "@/components/shell/BusinessSwitcherDialog";
import { clearLegacyActiveProcessId, setPendingNewProcess } from "@/lib/workshop-storage";
import type { UserProfile } from "@/lib/types";

interface ShellContextValue {
  user: UserProfile | null;
  userLoading: boolean;
  currentBusiness: { id: string; name: string } | null;
  newProjectOpen: boolean;
  connectionOpen: boolean;
  businessSwitcherOpen: boolean;
  creatingProject: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;
  openHermesConnection: () => void;
  closeHermesConnection: () => void;
  openBusinessSwitcher: () => void;
  closeBusinessSwitcher: () => void;
  switchBusiness: (id: string) => Promise<void>;
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
  const [businessSwitcherOpen, setBusinessSwitcherOpen] = useState(false);
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
    async (id: string) => {
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
      } catch {
        toast.error("Could not switch business");
      }
    },
    [router, refreshCurrentBusiness]
  );

  const openBusinessSwitcher = () => setBusinessSwitcherOpen(true);
  const closeBusinessSwitcher = () => setBusinessSwitcherOpen(false);

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
      businessSwitcherOpen,
      creatingProject,
      openNewProject: () => setNewProjectOpen(true),
      closeNewProject: () => setNewProjectOpen(false),
      openHermesConnection: () => setConnectionOpen(true),
      closeHermesConnection: () => setConnectionOpen(false),
      openBusinessSwitcher,
      closeBusinessSwitcher,
      switchBusiness,
      refreshCurrentBusiness,
      createProject,
      requestNewProcess,
      registerWorkshopNewProcess,
    }),
    [user, userLoading, currentBusiness, newProjectOpen, connectionOpen, businessSwitcherOpen, creatingProject, createProject, requestNewProcess, registerWorkshopNewProcess, switchBusiness, refreshCurrentBusiness]
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
      <BusinessSwitcherDialog
        open={businessSwitcherOpen}
        onClose={() => setBusinessSwitcherOpen(false)}
        currentBusinessId={currentBusiness?.id ?? null}
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