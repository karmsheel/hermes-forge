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
import {
  computeRoomReadiness,
  isRoomSoftUnlocked,
  preferredRoomForReadiness,
  roomLockHint,
  type RoomReadiness,
} from "@/lib/forge-room-readiness";
import { useShell } from "./ShellContext";

interface StageContextValue {
  stage: ForgeStage;
  setStage: (stage: ForgeStage) => void;
  /** True after first client hydration of stored stage */
  ready: boolean;
  /** Soft-unlock stats for the active business (null while loading / no business). */
  readiness: RoomReadiness | null;
  readinessLoading: boolean;
  refreshReadiness: () => Promise<void>;
  isRoomUnlocked: (room: ForgeStage) => boolean;
  roomLockHint: (room: ForgeStage) => string | null;
}

const StageContext = createContext<StageContextValue | null>(null);

export function StageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentBusiness } = useShell();
  const businessId = currentBusiness?.id ?? null;

  const [stage, setStageState] = useState<ForgeStage>("foundation");
  const [ready, setReady] = useState(false);
  const [readiness, setReadiness] = useState<RoomReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const refreshReadiness = useCallback(async () => {
    if (!businessId) {
      setReadiness(null);
      return;
    }
    setReadinessLoading(true);
    try {
      const res = await fetch("/api/foundation");
      if (!res.ok) {
        setReadiness(computeRoomReadiness({ processCount: 0, forgedCount: 0 }));
        return;
      }
      const data = (await res.json()) as {
        stats?: { processCount?: number; forgedCount?: number };
      };
      setReadiness(
        computeRoomReadiness({
          processCount: data.stats?.processCount ?? 0,
          forgedCount: data.stats?.forgedCount ?? 0,
        }),
      );
    } catch {
      setReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  // Re-check unlocks when navigating (e.g. after forge / seed in another room)
  useEffect(() => {
    if (!businessId) return;
    void refreshReadiness();
  }, [pathname, businessId, refreshReadiness]);

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

  // When readiness first loads and user has no stored room, prefer Foundation for thin
  useEffect(() => {
    if (!businessId || !readiness) return;
    const stored = readStoredStage(businessId);
    if (stored) return;
    const fromPath = stageFromPath(pathname);
    if (fromPath) return;
    const preferred = preferredRoomForReadiness(readiness);
    setStageState(preferred);
    writeStoredStage(businessId, preferred);
  }, [businessId, readiness, pathname]);

  const setStage = useCallback(
    (next: ForgeStage) => {
      if (!isForgeStage(next)) return;
      setStageState(next);
      if (businessId) writeStoredStage(businessId, next);
    },
    [businessId],
  );

  const isRoomUnlocked = useCallback(
    (room: ForgeStage) => isRoomSoftUnlocked(room, readiness),
    [readiness],
  );

  const hintFor = useCallback(
    (room: ForgeStage) => roomLockHint(room, readiness),
    [readiness],
  );

  const value = useMemo(
    () => ({
      stage,
      setStage,
      ready,
      readiness,
      readinessLoading,
      refreshReadiness,
      isRoomUnlocked,
      roomLockHint: hintFor,
    }),
    [
      stage,
      setStage,
      ready,
      readiness,
      readinessLoading,
      refreshReadiness,
      isRoomUnlocked,
      hintFor,
    ],
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
