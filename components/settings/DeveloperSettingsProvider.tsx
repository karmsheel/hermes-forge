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
  getShowGodModePage,
  getShowHermesModelSwitcher,
  getShowHomeCombinedPage,
  getShowHomeProcessStandardPicker,
  isDeveloperUnlocked,
  lockDeveloperMode as persistLockDeveloperMode,
  recordVersionUnlockClick,
  setPreviewUpdateIcon as persistPreviewUpdateIcon,
  setShowCronalyticsPage as persistShowCronalyticsPage,
  setShowGodModePage as persistShowGodModePage,
  setShowHermesModelSwitcher as persistShowHermesModelSwitcher,
  setShowHomeCombinedPage as persistShowHomeCombinedPage,
  setShowHomeProcessStandardPicker as persistShowHomeProcessStandardPicker,
} from "@/lib/developer-settings";

interface DeveloperSettingsContextValue {
  hydrated: boolean;
  isUnlocked: boolean;
  previewUpdateIcon: boolean;
  setPreviewUpdateIcon: (enabled: boolean) => void;
  showCronalyticsPage: boolean;
  setShowCronalyticsPage: (enabled: boolean) => void;
  showHomeCombinedPage: boolean;
  setShowHomeCombinedPage: (enabled: boolean) => void;
  showGodModePage: boolean;
  setShowGodModePage: (enabled: boolean) => void;
  showHomeProcessStandardPicker: boolean;
  setShowHomeProcessStandardPicker: (enabled: boolean) => void;
  showHermesModelSwitcher: boolean;
  setShowHermesModelSwitcher: (enabled: boolean) => void;
  recordVersionUnlockClick: () => void;
  lockDeveloperMode: () => void;
}

const DeveloperSettingsContext = createContext<DeveloperSettingsContextValue | null>(null);

export function DeveloperSettingsProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [previewUpdateIcon, setPreviewUpdateIconState] = useState(false);
  const [showCronalyticsPage, setShowCronalyticsPageState] = useState(false);
  const [showHomeCombinedPage, setShowHomeCombinedPageState] = useState(false);
  const [showGodModePage, setShowGodModePageState] = useState(false);
  const [showHomeProcessStandardPicker, setShowHomeProcessStandardPickerState] = useState(false);
  const [showHermesModelSwitcher, setShowHermesModelSwitcherState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsUnlocked(isDeveloperUnlocked());
    setPreviewUpdateIconState(getPreviewUpdateIcon());
    setShowCronalyticsPageState(getShowCronalyticsPage());
    setShowHomeCombinedPageState(getShowHomeCombinedPage());
    setShowGodModePageState(getShowGodModePage());
    setShowHomeProcessStandardPickerState(getShowHomeProcessStandardPicker());
    setShowHermesModelSwitcherState(getShowHermesModelSwitcher());
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

  const setShowHomeCombinedPage = useCallback((enabled: boolean) => {
    setShowHomeCombinedPageState(enabled);
    persistShowHomeCombinedPage(enabled);
  }, []);

  const setShowGodModePage = useCallback((enabled: boolean) => {
    setShowGodModePageState(enabled);
    persistShowGodModePage(enabled);
  }, []);

  const setShowHomeProcessStandardPicker = useCallback((enabled: boolean) => {
    setShowHomeProcessStandardPickerState(enabled);
    persistShowHomeProcessStandardPicker(enabled);
  }, []);

  const setShowHermesModelSwitcher = useCallback((enabled: boolean) => {
    setShowHermesModelSwitcherState(enabled);
    persistShowHermesModelSwitcher(enabled);
  }, []);

  const handleVersionUnlockClick = useCallback(() => {
    const result = recordVersionUnlockClick();
    if (result.justUnlocked) {
      setIsUnlocked(true);
      toast.success("Developer options unlocked");
    }
  }, []);

  const handleLockDeveloperMode = useCallback(() => {
    persistLockDeveloperMode();
    setIsUnlocked(false);
    setPreviewUpdateIconState(false);
    setShowCronalyticsPageState(false);
    setShowHomeCombinedPageState(false);
    setShowGodModePageState(false);
    setShowHomeProcessStandardPickerState(false);
    setShowHermesModelSwitcherState(false);
    toast.success("Developer mode hidden");
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      isUnlocked: hydrated ? isUnlocked : false,
      previewUpdateIcon: hydrated ? previewUpdateIcon : false,
      setPreviewUpdateIcon,
      showCronalyticsPage: hydrated ? showCronalyticsPage : false,
      setShowCronalyticsPage,
      showHomeCombinedPage: hydrated ? showHomeCombinedPage : false,
      setShowHomeCombinedPage,
      showGodModePage: hydrated ? showGodModePage : false,
      setShowGodModePage,
      showHomeProcessStandardPicker: hydrated ? showHomeProcessStandardPicker : false,
      setShowHomeProcessStandardPicker,
      showHermesModelSwitcher: hydrated ? showHermesModelSwitcher : false,
      setShowHermesModelSwitcher,
      recordVersionUnlockClick: handleVersionUnlockClick,
      lockDeveloperMode: handleLockDeveloperMode,
    }),
    [
      hydrated,
      isUnlocked,
      previewUpdateIcon,
      setPreviewUpdateIcon,
      showCronalyticsPage,
      setShowCronalyticsPage,
      showHomeCombinedPage,
      setShowHomeCombinedPage,
      showGodModePage,
      setShowGodModePage,
      showHomeProcessStandardPicker,
      setShowHomeProcessStandardPicker,
      showHermesModelSwitcher,
      setShowHermesModelSwitcher,
      handleVersionUnlockClick,
      handleLockDeveloperMode,
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