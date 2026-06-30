"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HermesConnectionDialog } from "@/components/hermes/HermesConnectionDialog";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { clearLegacyActiveProcessId } from "@/lib/workshop-storage";
import type { UserProfile } from "@/lib/types";

interface ShellContextValue {
  user: UserProfile | null;
  userLoading: boolean;
  newProjectOpen: boolean;
  connectionOpen: boolean;
  creatingProject: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;
  openHermesConnection: () => void;
  closeHermesConnection: () => void;
  createProject: (name: string, description: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setUserLoading(false));
  }, [router]);

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
        toast.error("Could not create project");
      } finally {
        setCreatingProject(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      userLoading,
      newProjectOpen,
      connectionOpen,
      creatingProject,
      openNewProject: () => setNewProjectOpen(true),
      closeNewProject: () => setNewProjectOpen(false),
      openHermesConnection: () => setConnectionOpen(true),
      closeHermesConnection: () => setConnectionOpen(false),
      createProject,
      logout,
    }),
    [user, userLoading, newProjectOpen, connectionOpen, creatingProject, createProject, logout]
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