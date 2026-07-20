"use client";

import { useEffect, useState } from "react";
import {
  isForgeDesktop,
  isWindowMaximized,
  onWindowMaximizedChange,
} from "@/lib/forge-desktop";

/** Track whether the Electron window is maximized (for restore vs maximize icon). */
export function useWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isForgeDesktop()) return;
    let cancelled = false;
    void isWindowMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    const unsub = onWindowMaximizedChange((value) => {
      if (!cancelled) setMaximized(value);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return maximized;
}
