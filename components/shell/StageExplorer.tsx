"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  FORGE_STAGE_DESCRIPTIONS,
  FORGE_STAGE_LABELS,
  FORGE_STAGES,
  STAGE_DEFAULT_ROUTES,
  pathBelongsToStage,
  type ForgeStage,
} from "@/lib/forge-stage";
import { useForgeTabs } from "./ForgeTabProvider";
import { useForgeStage } from "./StageProvider";

/**
 * Segmented Map | Monitor | Automate control — sits next to the business picker.
 */
export function StageExplorer() {
  const { stage, setStage } = useForgeStage();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: tabsEnabled, navigateActiveTab } = useForgeTabs();

  function handleSelect(id: ForgeStage) {
    setStage(id);
    if (!pathBelongsToStage(pathname, id)) {
      const href = STAGE_DEFAULT_ROUTES[id];
      if (tabsEnabled) {
        navigateActiveTab(href);
      } else {
        router.push(href);
      }
    }
  }

  return (
    <div
      className="stage-explorer"
      role="tablist"
      aria-label="Business stage"
    >
      {FORGE_STAGES.map((id: ForgeStage) => {
        const active = stage === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`stage-explorer__tab${active ? " is-active" : ""}`}
            title={FORGE_STAGE_DESCRIPTIONS[id]}
            onClick={() => handleSelect(id)}
          >
            {FORGE_STAGE_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
