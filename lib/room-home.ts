import type { ForgeStage } from "@/lib/forge-stage";
import { ROOM_HOME_ROUTES } from "@/lib/forge-stage";

export type RoomHomeCopy = {
  room: ForgeStage;
  title: string;
  subtitle: string;
  roomBadge: string;
};

/** Hero copy for each room's Home surface. */
export const ROOM_HOME_COPY: Record<ForgeStage, RoomHomeCopy> = {
  foundation: {
    room: "foundation",
    roomBadge: "Foundation home",
    title: "What will you FORGE today?",
    subtitle:
      "Start in Foundation with Overlord — sketch the plant, then map and forge",
  },
  inventory: {
    room: "inventory",
    roomBadge: "Inventory home",
    title: "What will you STORE today?",
    subtitle:
      "Digital assets and objects the business uses or ships — content, drafts, and more",
  },
  map: {
    room: "map",
    roomBadge: "Map home",
    title: "What will you MAP today?",
    subtitle:
      "See the business as a plant — open processes in Workshop, link flows, and forge",
  },
  monitor: {
    room: "monitor",
    roomBadge: "Monitor home",
    title: "What will you MEASURE today?",
    subtitle:
      "Instrument forged work — track metrics and health across the plant",
  },
  automate: {
    room: "automate",
    roomBadge: "Automate home",
    title: "What will you AUTOMATE today?",
    subtitle:
      "Assign agents and run jobs on forged processes — design, deploy, and iterate",
  },
};

export function roomHomeHref(room: ForgeStage): string {
  return ROOM_HOME_ROUTES[room];
}
