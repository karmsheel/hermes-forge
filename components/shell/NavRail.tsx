"use client";

import Link from "next/link";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import {
  Activity,
  Clock,
  FileText,
  FolderKanban,
  Hammer,
  Home,
  Layers,
  Newspaper,
  Plus,
  Scale,
  ScanEye,
  ScrollText,
  Target,
  User,
  Users,
  Zap,
} from "lucide-react";
import { DesktopUpdateIndicator } from "@/components/desktop/DesktopUpdateIndicator";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { isNavIdInStage, ROOM_HOME_ROUTES } from "@/lib/forge-stage";
import { useForgeTabs } from "./ForgeTabProvider";
import { NavRailVersion } from "./NavRailVersion";
import { NavThemeModeToggle } from "./NavThemeModeToggle";
import { useShell } from "./ShellContext";
import { useForgeStage } from "./StageProvider";

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
  const { requestNewProcess, user, userLoading, openProfile, profileOpen } = useShell();
  const { stage } = useForgeStage();
  const { showCronalyticsPage } = useDeveloperSettings();
  const { enabled: tabsEnabled, activeTab, navigateActiveTab, openInNewTab } = useForgeTabs();
  /** Prefer active tab route for highlight so desktop tabs stay consistent */
  const activePath = tabsEnabled && activeTab ? activeTab.route.split("?")[0]! : pathname;
  const profileActive = profileOpen;

  const roomHomeHref = ROOM_HOME_ROUTES[stage];

  const mainItems: NavItem[] = [
    {
      id: "home",
      href: roomHomeHref,
      label: "Home",
      icon: Home,
      match: (path) => path === roomHomeHref || (stage === "foundation" && path === "/"),
    },
    {
      id: "foundation",
      href: "/foundation",
      label: "Foundation",
      icon: Layers,
      match: (path) => path.startsWith("/foundation"),
    },
    {
      id: "god-mode",
      href: "/god-mode",
      label: "Plant",
      icon: ScanEye,
      match: (path) => path.startsWith("/god-mode"),
    },
    {
      id: "functions",
      href: "/functions",
      label: "Functions",
      icon: FolderKanban,
      match: (path) => path === "/functions",
    },
    {
      id: "workshop",
      href: "/workshop",
      label: "Workshop",
      icon: Hammer,
      match: (path) => path.startsWith("/workshop"),
    },
    {
      id: "personnel",
      href: "/personnel",
      label: "Personnel",
      icon: Users,
      match: (path) => path.startsWith("/personnel"),
    },
    {
      id: "documents",
      href: "/documents",
      label: "Documents",
      icon: FileText,
      match: (path) => path.startsWith("/documents"),
    },
    {
      id: "metrics",
      href: "/metrics",
      label: "Metrics",
      icon: Activity,
      match: (path) => path.startsWith("/metrics"),
    },
    {
      id: "content",
      href: "/content",
      label: "Content",
      icon: Newspaper,
      match: (path) => path.startsWith("/content"),
    },
    {
      id: "automations",
      href: "/automations",
      label: "Automations",
      icon: Zap,
      match: (path) => path.startsWith("/automations"),
    },
    {
      id: "automation-analysis",
      href: "/automation-analysis",
      label: "Automation Analysis",
      icon: Target,
      match: (path) => path.startsWith("/automation-analysis"),
    },
    {
      id: "cronalytics",
      href: "/cronalytics",
      label: "Cronalytics",
      icon: Clock,
      match: (path) => path.startsWith("/cronalytics"),
    },
  ];

  /** Holistic: always visible across rooms (footer, above account controls). */
  const holisticItems: NavItem[] = [
    {
      id: "decisions",
      href: "/decisions",
      label: "Decisions",
      icon: Scale,
      match: (path) => path.startsWith("/decisions"),
    },
    {
      id: "log",
      href: "/log",
      label: "Business log",
      icon: ScrollText,
      match: (path) => path.startsWith("/log"),
    },
  ];

  function isActive(item: NavItem) {
    if (item.match) return item.match(activePath);
    return item.href === activePath;
  }

  function handleShellNav(href: string, e: MouseEvent) {
    if (!tabsEnabled) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      openInNewTab(href);
      return;
    }
    e.preventDefault();
    navigateActiveTab(href);
  }

  return (
    <nav className="nav-rail" aria-label="Main navigation">
      <div className="nav-rail__section">
        <Link
          href="/business-manager"
          className={`nav-rail__logo${activePath.startsWith("/business-manager") ? " is-active" : ""}`}
          title="Business Manager"
          aria-label="Business Manager"
          onClick={(e) => handleShellNav("/business-manager", e)}
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
          .filter((item) => isNavIdInStage(item.id, stage))
          .filter((item) => item.id !== "cronalytics" || showCronalyticsPage)
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
              onClick={(e) => handleShellNav(item.href!, e)}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>

      <div className="nav-rail__section nav-rail__section--footer">
        {holisticItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              href={item.href!}
              className={`nav-rail__item${active ? " is-active" : ""}`}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={(e) => handleShellNav(item.href!, e)}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
        <div className="nav-rail__divider" role="separator" aria-hidden="true" />
        <NavThemeModeToggle className="nav-rail__theme-toggle" />
        <div className="nav-rail__settings-wrap">
          <SettingsMenu className="nav-rail__settings" placement="right-end" />
        </div>
        {!userLoading && user ? (
          <button
            type="button"
            className={`nav-rail__item${profileActive ? " is-active" : ""}`}
            title={user.name || "Profile"}
            aria-label={user.name || "Profile"}
            aria-pressed={profileActive}
            onClick={() => openProfile()}
          >
            <User className="w-5 h-5" />
          </button>
        ) : null}
        <div className="nav-rail__footer-meta">
          <DesktopUpdateIndicator />
          <NavRailVersion />
        </div>
      </div>
    </nav>
  );
}