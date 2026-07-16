"use client";

import { Lock } from "lucide-react";
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
 * Room switcher: Foundation | Map | Monitor | Automate.
 * Soft-locked rooms stay selectable with lock affordance + tooltip.
 */
export function StageExplorer() {
  const { stage, setStage, isRoomUnlocked, roomLockHint } = useForgeStage();
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
      aria-label="Forge room"
    >
      {FORGE_STAGES.map((id: ForgeStage) => {
        const active = stage === id;
        const unlocked = isRoomUnlocked(id);
        const hint = roomLockHint(id);
        const title = unlocked
          ? FORGE_STAGE_DESCRIPTIONS[id]
          : `${FORGE_STAGE_DESCRIPTIONS[id]} — ${hint ?? "Not ready yet"}`;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={
              unlocked
                ? FORGE_STAGE_LABELS[id]
                : `${FORGE_STAGE_LABELS[id]} (soft locked)`
            }
            className={`stage-explorer__tab${active ? " is-active" : ""}${
              !unlocked ? " is-locked" : ""
            }`}
            title={title}
            onClick={() => handleSelect(id)}
          >
            {!unlocked ? (
              <Lock className="stage-explorer__lock" aria-hidden />
            ) : null}
            {FORGE_STAGE_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
