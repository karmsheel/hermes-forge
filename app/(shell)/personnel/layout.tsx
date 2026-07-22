"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PersonnelSubnav } from "@/components/personnel/PersonnelSubnav";

export default function PersonnelLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  // Full-bleed forced hire: no roster subnav chrome
  const isForcedHire = pathname.startsWith("/personnel/hire");

  if (isForcedHire) {
    return <>{children}</>;
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full">
      <PersonnelSubnav />
      {children}
    </main>
  );
}
