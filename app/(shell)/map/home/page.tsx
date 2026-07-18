"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";
import { SoftRoomLock } from "@/components/shell/SoftRoomLock";
import { useForgeStage } from "@/components/shell/StageProvider";

/** Map room Home — same hero surface as Foundation Home, room-scoped copy. */
export default function MapHomePage() {
  const { isRoomUnlocked } = useForgeStage();
  const unlocked = isRoomUnlocked("map");

  if (!unlocked) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <SoftRoomLock room="map" />
      </main>
    );
  }

  return (
    <>
      <HomePageContext room="map" />
      <HomeHero room="map" />
    </>
  );
}
