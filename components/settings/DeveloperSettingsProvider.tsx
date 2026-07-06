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
import { toast } from "sonner";
import {
  getPreviewUpdateIcon,
  getShowCronalyticsPage,
  getShowDecisionsPage,
  isDeveloperUnlocked,
  recordVersionUnlockClick,
  setPreviewUpdateIcon as persistPreviewUpdateIcon,
  setShowCronalyticsPage as persistShowCronalyticsPage,
  setShowDecisionsPage as persistShowDecisionsPage,
} from "@/lib/developer-settings";

interface DeveloperSettingsContextValue {
  hydrated: boolean;
  isUnlocked: boolean;
  previewUpdateIcon: boolean;
  setPreviewUpdateIcon: (enabled: boolean) => void;
  showCronalyticsPage: boolean;
  setShowCronalyticsPage: (enabled: boolean) => void;
  showDecisionsPage: boolean;
  setShowDecisionsPage: (enabled: boolean) => void;
  recordVersionUnlockClick: () => void;
}

const DeveloperSettingsContext = createContext<DeveloperSettingsContextValue | null>(null);

export function DeveloperSettingsProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [previewUpdateIcon, setPreviewUpdateIconState] = useState(false);
  const [showCronalyticsPage, setShowCronalyticsPageState] = useState(false);
  const [showDecisionsPage, setShowDecisionsPageState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsUnlocked(isDeveloperUnlocked());
    setPreviewUpdateIconState(getPreviewUpdateIcon());
    setShowCronalyticsPageState(getShowCronalyticsPage());
    setShowDecisionsPageState(getShowDecisionsPage());
    setHydrated(true);
  }, []);

  const setPreviewUpdateIcon = useCallback((enabled: boolean) => {
    setPreviewUpdateIconState(enabled);
    persistPreviewUpdateIcon(enabled);
  }, []);

  const setShowCronalyticsPage = useCallback((enabled: boolean) => {
    setShowCronalyticsPageState(enabled);
    persistShowCronalyticsPage(enabled);
  }, []);

  const setShowDecisionsPage = useCallback((enabled: boolean) => {
    setShowDecisionsPageState(enabled);
    persistShowDecisionsPage(enabled);
  }, []);

  const handleVersionUnlockClick = useCallback(() => {
    const result = recordVersionUnlockClick();
    if (result.justUnlocked) {
      setIsUnlocked(true);
      toast.success("Developer options unlocked");
    }
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      isUnlocked: hydrated ? isUnlocked : false,
      previewUpdateIcon: hydrated ? previewUpdateIcon : false,
      setPreviewUpdateIcon,
      showCronalyticsPage: hydrated ? showCronalyticsPage : false,
      setShowCronalyticsPage,
      showDecisionsPage: hydrated ? showDecisionsPage : false,
      setShowDecisionsPage,
      recordVersionUnlockClick: handleVersionUnlockClick,
    }),
    [
      hydrated,
      isUnlocked,
      previewUpdateIcon,
      setPreviewUpdateIcon,
      showCronalyticsPage,
      setShowCronalyticsPage,
      showDecisionsPage,
      setShowDecisionsPage,
      handleVersionUnlockClick,
    ]
  );

  return (
    <DeveloperSettingsContext.Provider value={value}>
      {children}
    </DeveloperSettingsContext.Provider>
  );
}

export function useDeveloperSettings() {
  const ctx = useContext(DeveloperSettingsContext);
  if (!ctx) {
    throw new Error("useDeveloperSettings must be used within DeveloperSettingsProvider");
  }
  return ctx;
}