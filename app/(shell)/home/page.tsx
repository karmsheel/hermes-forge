"use client";

import { HomeHero } from "@/components/home/HomeHero";
import { RecentProcessesStrip } from "@/components/home/RecentProjectsStrip";

export default function HomePage() {
  return <HomeHero belowFold={<RecentProcessesStrip />} />;
}