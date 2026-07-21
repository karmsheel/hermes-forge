"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { resolveThemePreference } from "@/lib/theme";

function getResolvedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return resolveThemePreference("system");
}

export function ForgeToaster() {
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const sync = () => setResolved(getResolvedTheme());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!document.documentElement.hasAttribute("data-theme")) sync();
    };
    media.addEventListener("change", onSystemChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onSystemChange);
    };
  }, []);

  return (
    <Toaster
      position="top-center"
      theme={resolved}
      richColors
      offset={16}
    />
  );
}