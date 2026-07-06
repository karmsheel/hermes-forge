export type Locale = "en" | "es" | "fr" | "de" | "ja" | "zh" | "zh-hant";

export interface LocaleMeta {
  name: string;
  englishName: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { name: "English", englishName: "English" },
  es: { name: "Español", englishName: "Spanish" },
  fr: { name: "Français", englishName: "French" },
  de: { name: "Deutsch", englishName: "German" },
  ja: { name: "日本語", englishName: "Japanese" },
  zh: { name: "简体中文", englishName: "Chinese (Simplified)" },
  "zh-hant": { name: "繁體中文", englishName: "Chinese (Traditional)" },
};

export const LOCALE_ORDER: Locale[] = ["en", "zh", "zh-hant", "ja", "es", "fr", "de"];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "hermes-forge-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && value in LOCALE_META;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}