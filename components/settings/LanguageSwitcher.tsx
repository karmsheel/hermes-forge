"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LOCALE_META, type Locale } from "@/lib/locale";
import { LOCALE_ORDER, useLocale } from "@/components/i18n/LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, isSavingLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = LOCALE_META[locale];

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = LOCALE_ORDER.filter((code) => {
    if (!normalizedQuery) return true;
    const meta = LOCALE_META[code];
    return (
      meta.name.toLowerCase().includes(normalizedQuery) ||
      meta.englishName.toLowerCase().includes(normalizedQuery) ||
      code.toLowerCase().includes(normalizedQuery)
    );
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectLocale(code: Locale) {
    if (code === locale || isSavingLocale) {
      setOpen(false);
      return;
    }
    setLocale(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="language-switcher" ref={wrapRef}>
      <button
        type="button"
        className="language-switcher__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        disabled={isSavingLocale}
      >
        <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
      </button>

      {open && (
        <div className="language-switcher__menu" role="listbox" id={listId} aria-label="Language">
          <input
            className="language-switcher__search input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search languages…"
            aria-label="Search languages"
          />
          <ul className="language-switcher__list">
            {filtered.length === 0 ? (
              <li className="language-switcher__empty">No languages match.</li>
            ) : (
              filtered.map((code) => {
                const meta = LOCALE_META[code];
                const selected = code === locale;
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`language-switcher__option${selected ? " is-selected" : ""}`}
                      onClick={() => selectLocale(code)}
                    >
                      <Check
                        className={`w-3.5 h-3.5 shrink-0${selected ? "" : " invisible"}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-left">{meta.name}</span>
                      <span className="language-switcher__code">{code}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}