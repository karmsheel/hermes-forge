import Link from "next/link";
import { Building2, LayoutDashboard, Wrench, Zap } from "lucide-react";

interface AppNavProps {
  current?: "projects" | "workshop" | "dashboard" | "automations";
  className?: string;
}

const links = [
  { id: "projects" as const, href: "/projects", label: "Projects", icon: Building2 },
  { id: "workshop" as const, href: "/workshop", label: "Workshop", icon: Wrench },
  { id: "automations" as const, href: "/automations", label: "Automations", icon: Zap },
  { id: "dashboard" as const, href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppNav({ current, className = "" }: AppNavProps) {
  return (
    <nav className={`flex items-center gap-2 ${className}`}>
      {links.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={`btn-secondary text-xs py-1 px-2 flex items-center gap-1 ${
            current === id ? "border-emerald-500/40 text-emerald-400" : ""
          }`}
        >
          <Icon className="w-3 h-3" />
          {label}
        </Link>
      ))}
    </nav>
  );
}