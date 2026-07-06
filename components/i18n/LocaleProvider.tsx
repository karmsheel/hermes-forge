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
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  LOCALE_ORDER,
  persistLocale,
  type Locale,
} from "@/lib/locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isSavingLocale: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === "undefined" ? DEFAULT_LOCALE : getStoredLocale()
  );
  const [isSavingLocale, setIsSavingLocale] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setIsSavingLocale(true);
    try {
      setLocaleState(next);
      persistLocale(next);
      document.documentElement.lang = next;
    } finally {
      setIsSavingLocale(false);
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, isSavingLocale }),
    [locale, setLocale, isSavingLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export { LOCALE_ORDER };