"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomePageContext } from "@/components/chatbar/page-providers/HomePageContext";
import { HomeCombined } from "@/components/home/HomeCombined";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";

/**
 * Experimental Foundation Home: composer left + simple plant sketch right.
 * Dev-gated — enable under Settings → Developer → Show Home Combined page.
 */
export default function HomeCombinedPage() {
  const router = useRouter();
  const { hydrated, showHomeCombinedPage } = useDeveloperSettings();

  useEffect(() => {
    if (hydrated && !showHomeCombinedPage) {
      router.replace("/home");
    }
  }, [hydrated, showHomeCombinedPage, router]);

  if (!hydrated || !showHomeCombinedPage) {
    return null;
  }

  return (
    <>
      <HomePageContext room="foundation" />
      <HomeCombined />
    </>
  );
}
