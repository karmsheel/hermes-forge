"use client";

import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeHero } from "@/components/home/HomeHero";

export default function HomePage() {
  return (
    <>
      <HomePageContext />
      <HomeHero />
    </>
  );
}
