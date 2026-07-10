"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";
import { RecentProcessesStrip } from "@/components/home/RecentProjectsStrip";

export default function HomePage() {
  return (
    <>
      <HomePageContext />
      <HomeHero belowFold={<RecentProcessesStrip />} />
    </>
  );
}