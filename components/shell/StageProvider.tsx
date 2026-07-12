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
import { usePathname } from "next/navigation";
import {
  defaultStageForPath,
  isForgeStage,
  readStoredStage,
  stageFromPath,
  writeStoredStage,
  type ForgeStage,
} from "@/lib/forge-stage";
import { useShell } from "./ShellContext";

interface StageContextValue {
  stage: ForgeStage;
  setStage: (stage: ForgeStage) => void;
  /** True after first client hydration of stored stage */
  ready: boolean;
}

const StageContext = createContext<StageContextValue | null>(null);

export function StageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentBusiness } = useShell();
  const businessId = currentBusiness?.id ?? null;

  const [stage, setStageState] = useState<ForgeStage>("map");
  const [ready, setReady] = useState(false);

  // Hydrate from storage + path when business or route changes
  useEffect(() => {
    const fromPath = stageFromPath(pathname);
    const stored = readStoredStage(businessId);

    if (fromPath) {
      setStageState(fromPath);
      if (businessId) writeStoredStage(businessId, fromPath);
    } else if (stored) {
      setStageState(stored);
    } else {
      setStageState(defaultStageForPath(pathname));
    }
    setReady(true);
  }, [businessId, pathname]);

  const setStage = useCallback(
    (next: ForgeStage) => {
      if (!isForgeStage(next)) return;
      setStageState(next);
      if (businessId) writeStoredStage(businessId, next);
    },
    [businessId],
  );

  const value = useMemo(
    () => ({ stage, setStage, ready }),
    [stage, setStage, ready],
  );

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useForgeStage() {
  const ctx = useContext(StageContext);
  if (!ctx) {
    throw new Error("useForgeStage must be used within StageProvider");
  }
  return ctx;
}
