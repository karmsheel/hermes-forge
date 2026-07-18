"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";

/**
 * Product Home: composer + template starters.
 * Send seeds a Foundation draft (6.7) and navigates to `/foundation`.
 * Hard Home dissolve / per-room homes remain deferred.
 */
export default function HomePage() {
  return (
    <>
      <HomePageContext />
      <HomeHero />
    </>
  );
}
