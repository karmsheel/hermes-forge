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
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Team</div>
        <h1 className="text-3xl font-semibold tracking-tight">Personnel</h1>
      </div>
      <PersonnelSubnav />
      {children}
    </main>
  );
}
