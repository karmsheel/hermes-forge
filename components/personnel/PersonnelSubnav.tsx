"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";

const TABS = [
  {
    href: "/personnel",
    label: "Roster",
    icon: Users,
    match: (path: string) =>
      path === "/personnel" || path.startsWith("/personnel/hire"),
  },
  {
    href: "/personnel/academy",
    label: "Agent Academy",
    icon: GraduationCap,
    match: (path: string) => path.startsWith("/personnel/academy"),
  },
] as const;

export function PersonnelSubnav() {
  const pathname = usePathname() || "/personnel";

  return (
    <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Personnel sections">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              active
                ? "border-selected bg-bg-elevated text-text font-medium"
                : "border-border bg-bg-subtle text-text-muted hover:border-border-strong hover:text-text"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
