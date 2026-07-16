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
 * Room switcher as two pills:
 *   [Foundation] ····· [Map | Monitor | Automate]
 * Locked rooms stay hidden. New businesses only see the Foundation pill.
 */
export function StageExplorer() {
  const { stage, setStage, isRoomUnlocked } = useForgeStage();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: tabsEnabled, navigateActiveTab } = useForgeTabs();

  const visibleRooms = FORGE_STAGES.filter((id) => isRoomUnlocked(id));
  const foundationVisible = visibleRooms.includes("foundation");
  const opsRooms = visibleRooms.filter((id): id is ForgeStage => id !== "foundation");
  const showOpsBridge = foundationVisible && opsRooms.length > 0;

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

  function renderTab(id: ForgeStage) {
    const active = stage === id;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={FORGE_STAGE_LABELS[id]}
        className={`stage-explorer__tab${active ? " is-active" : ""}`}
        data-room={id}
        title={FORGE_STAGE_DESCRIPTIONS[id]}
        onClick={() => handleSelect(id)}
      >
        <span className="stage-explorer__label">{FORGE_STAGE_LABELS[id]}</span>
      </button>
    );
  }

  return (
    <div className="stage-explorer-cluster" role="tablist" aria-label="Forge room">
      {foundationVisible ? (
        <div className="stage-explorer stage-explorer--foundation">
          {renderTab("foundation")}
        </div>
      ) : null}

      {showOpsBridge ? (
        <div className="stage-explorer__bridge" aria-hidden="true" />
      ) : null}

      {opsRooms.length > 0 ? (
        <div className="stage-explorer stage-explorer--ops">
          {opsRooms.map((id) => renderTab(id))}
        </div>
      ) : null}
    </div>
  );
}
