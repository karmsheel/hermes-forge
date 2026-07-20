"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";

/** Inventory room Home — digital assets lobby; Content is the primary tool. */
export default function InventoryHomePage() {
  return (
    <>
      <HomePageContext room="inventory" />
      <HomeHero room="inventory" />
    </>
  );
}
