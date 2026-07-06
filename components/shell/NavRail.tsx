"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { usePathname } from "next/navigation";
import {
  Clock,
  FolderKanban,
  Hammer,
  Home,
  LayoutDashboard,
  PlugZap,
  Plus,
  Scale,
  ScanEye,
  ScrollText,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { APP_VERSION } from "@/lib/app-meta";
import { isForgeDesktop } from "@/lib/forge-desktop";
import { useShell } from "./ShellContext";

type NavItem = {
  id: string;
  href?: string;
  label: string;
  icon: typeof Home;
  onClick?: () => void;
  match?: (path: string) => boolean;
};

export function NavRail() {
  const pathname = usePathname();
  const { requestNewProcess, openHermesConnection } = useShell();
  const { showCronalyticsPage, showDecisionsPage } = useDeveloperSettings();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isForgeDesktop());
  }, []);

  const mainItems: NavItem[] = [
    {
      id: "home",
      href: "/home",
      label: "Home",
      icon: Home,
      match: (path) => path === "/home",
    },
    {
      id: "projects",
      href: "/projects",
      label: "Functions",
      icon: FolderKanban,
      match: (path) => path === "/projects",
    },
    {
      id: "personnel",
      href: "/personnel",
      label: "Personnel",
      icon: Users,
      match: (path) => path.startsWith("/personnel"),
    },
    {
      id: "workshop",
      href: "/workshop",
      label: "Workshop",
      icon: Hammer,
      match: (path) => path.startsWith("/workshop"),
    },
    {
      id: "god-mode",
      href: "/god-mode",
      label: "God Mode",
      icon: ScanEye,
      match: (path) => path.startsWith("/god-mode"),
    },
    {
      id: "automations",
      href: "/automations",
      label: "Automations",
      icon: Zap,
      match: (path) => path.startsWith("/automations"),
    },
    {
      id: "dashboard",
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      match: (path) => path.startsWith("/dashboard"),
    },
    {
      id: "log",
      href: "/log",
      label: "Business log",
      icon: ScrollText,
      match: (path) => path.startsWith("/log"),
    },
    {
      id: "decisions",
      href: "/decisions",
      label: "Decisions",
      icon: Scale,
      match: (path) => path.startsWith("/decisions"),
    },
    {
      id: "cronalytics",
      href: "/cronalytics",
      label: "Cronalytics",
      icon: Clock,
      match: (path) => path.startsWith("/cronalytics"),
    },
  ];

  function isActive(item: NavItem) {
    if (item.match) return item.match(pathname);
    return item.href === pathname;
  }

  return (
    <nav className="nav-rail" aria-label="Main navigation">
      <div className="nav-rail__section">
        <Link
          href="/business-manager"
          className={`nav-rail__logo${pathname.startsWith("/business-manager") ? " is-active" : ""}`}
          title="Business Manager"
          aria-label="Business Manager"
        >
          <HermesForgeMark className="hermes-forge-mark nav-rail__logo-art" />
        </Link>

        <button
          type="button"
          className="nav-rail__item nav-rail__item--accent"
          onClick={requestNewProcess}
          title="New process"
          aria-label="New process"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="nav-rail__section nav-rail__section--grow">
        {mainItems
          .filter((item) => item.id !== "cronalytics" || showCronalyticsPage)
          .filter((item) => item.id !== "decisions" || showDecisionsPage)
          .map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          if (item.onClick) {
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-rail__item${active ? " is-active" : ""}`}
                onClick={item.onClick}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href!}
              className={`nav-rail__item${active ? " is-active" : ""}`}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>

      <div className="nav-rail__section nav-rail__section--footer">
        <button
          type="button"
          className="nav-rail__item"
          onClick={openHermesConnection}
          title="Hermes connection"
          aria-label="Hermes connection"
        >
          <PlugZap className="w-5 h-5" />
        </button>
        <Link
          href="/profile"
          className={`nav-rail__item${pathname.startsWith("/profile") ? " is-active" : ""}`}
          title="Profile"
          aria-label="Profile"
          aria-current={pathname.startsWith("/profile") ? "page" : undefined}
        >
          <User className="w-5 h-5" />
        </Link>
        {isDesktop ? (
          <span className="nav-rail__version" title={`Version ${APP_VERSION}`}>
            v{APP_VERSION}
          </span>
        ) : null}
      </div>
    </nav>
  );
}