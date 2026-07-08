"use client";

import { useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/app-meta";

export function useAppVersion(): string {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    if (!window.forgeDesktop?.getAppVersion) return;
    void window.forgeDesktop.getAppVersion().then((runtimeVersion) => {
      if (runtimeVersion) setVersion(runtimeVersion);
    });
  }, []);

  return version;
}