"use client";

import { HomeHero } from "@/components/home/HomeHero";
import { RecentProjectsStrip } from "@/components/home/RecentProjectsStrip";

export default function HomePage() {
  return (
    <div className="home-page">
      <HomeHero />
      <RecentProjectsStrip />
    </div>
  );
}