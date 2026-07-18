"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";

/**
 * Foundation room Home: composer + template starters.
 * Map / Monitor / Automate have sibling homes under `/map/home`, etc.
 */
export default function HomePage() {
  return (
    <>
      <HomePageContext room="foundation" />
      <HomeHero room="foundation" />
    </>
  );
}
