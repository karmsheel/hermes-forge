"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";

/**
 * Product Home remains available for templates/composer.
 * New/thin businesses default to Foundation room (room switcher + hire +
 * start-from-brief); room-specific homes are deferred (6.7).
 */
export default function HomePage() {
  return (
    <>
      <HomePageContext />
      <HomeHero />
    </>
  );
}
