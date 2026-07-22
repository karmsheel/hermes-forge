"use client";

import { usePathname } from "next/navigation";
import { pageNameFromPath } from "@/lib/page-name";
import { useForgeTabs } from "./ForgeTabProvider";

/**
 * Shell page name — left-aligned under the business picker.
 * Path follows multi-tab active route when tabs are enabled (same as NavRail).
 */
export function PageName() {
  const pathname = usePathname();
  const { enabled: tabsEnabled, activeTab } = useForgeTabs();
  const activePath =
    tabsEnabled && activeTab ? activeTab.route.split("?")[0]! : pathname || "/";
  const name = pageNameFromPath(activePath);

  if (!name) return null;

  return (
    <div className="shell-page-name-strip">
      <h1 id="shell-page-name" className="shell-page-name">
        {name}
      </h1>
    </div>
  );
}
