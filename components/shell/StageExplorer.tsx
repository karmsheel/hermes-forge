"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  FORGE_STAGE_DESCRIPTIONS,
  FORGE_STAGE_LABELS,
  FORGE_STAGES,
  STAGE_DEFAULT_ROUTES,
  type ForgeStage,
} from "@/lib/forge-stage";
import { useForgeTabs } from "./ForgeTabProvider";
import { useForgeStage } from "./StageProvider";

const OPS_ROOMS = FORGE_STAGES.filter((id): id is ForgeStage => id !== "foundation");

function useRoomNavigation() {
  const { stage, setStage, isRoomUnlocked } = useForgeStage();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: tabsEnabled, navigateActiveTab } = useForgeTabs();

  function handleSelect(id: ForgeStage) {
    setStage(id);
    // Always land on that room's Home when switching rooms.
    const href = STAGE_DEFAULT_ROUTES[id];
    const current = pathname.split("?")[0] || "/";
    if (current === href) return;
    if (tabsEnabled) {
      navigateActiveTab(href);
    } else {
      router.push(href);
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

  return { isRoomUnlocked, renderTab };
}

/**
 * Foundation room pill — sits between the business picker and the MMA cluster
 * with equal dotted bridges on either side (layout owned by AppTopBar).
 */
export function StageExplorerFoundation() {
  const { isRoomUnlocked, renderTab } = useRoomNavigation();

  if (!isRoomUnlocked("foundation")) return null;

  return (
    <div
      className="shell-chrome stage-explorer stage-explorer--foundation"
      role="tablist"
      aria-label="Foundation room"
    >
      {renderTab("foundation")}
    </div>
  );
}

/**
 * Map | Monitor | Automate pill — page-centered over the hero.
 * Locked rooms stay hidden; the topbar reserves a fixed center slot so
 * Foundation does not jump when rooms unlock.
 */
export function StageExplorerOps() {
  const { isRoomUnlocked, renderTab } = useRoomNavigation();
  const opsRooms = OPS_ROOMS.filter((id) => isRoomUnlocked(id));

  if (opsRooms.length === 0) {
    // Keep the center anchor in the accessibility tree empty but present for layout.
    return <div className="stage-explorer-ops-anchor" aria-hidden="true" />;
  }

  return (
    <div
      className="shell-chrome stage-explorer stage-explorer--ops"
      role="tablist"
      aria-label="Operating rooms"
    >
      {opsRooms.map((id) => renderTab(id))}
    </div>
  );
}
