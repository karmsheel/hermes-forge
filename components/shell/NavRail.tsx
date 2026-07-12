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
  MessageSquare,
  Newspaper,
  PlugZap,
  Plus,
  Scale,
  ScanEye,
  ScrollText,
  Users,
  Zap,
} from "lucide-react";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { DesktopUpdateIndicator } from "@/components/desktop/DesktopUpdateIndicator";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { isNavIdInStage } from "@/lib/forge-stage";
import { useForgeTabs } from "./ForgeTabProvider";
import { NavRailVersion } from "./NavRailVersion";
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
  const { requestNewProcess, openHermesConnection } = useShell();
  const { stage } = useForgeStage();
  const { isOpen: chatOpen, toggle: toggleChat } = useChatbar();
  const { showCronalyticsPage, showDecisionsPage, showGodModePage } = useDeveloperSettings();
  const { enabled: tabsEnabled, activeTab, navigateActiveTab, openInNewTab } = useForgeTabs();
  /** Prefer active tab route for highlight so desktop tabs stay consistent */
  const activePath = tabsEnabled && activeTab ? activeTab.route.split("?")[0]! : pathname;

  const mainItems: NavItem[] = [
    {
      id: "home",
      href: "/home",
      label: "Home",
      icon: Home,
      match: (path) => path === "/home",
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
          .filter((item) => item.id !== "god-mode" || showGodModePage)
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
              onClick={(e) => handleShellNav(item.href!, e)}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>

      <div className="nav-rail__section nav-rail__section--footer">
        <button
          type="button"
          className={`nav-rail__item${chatOpen ? " is-active" : ""}`}
          onClick={toggleChat}
          title={chatOpen ? "Hide Hermes chat (Alt+H)" : "Show Hermes chat (Alt+H)"}
          aria-label={chatOpen ? "Hide Hermes chat" : "Show Hermes chat"}
          aria-pressed={chatOpen}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="nav-rail__item"
          onClick={openHermesConnection}
          title="Hermes connection"
          aria-label="Hermes connection"
        >
          <PlugZap className="w-5 h-5" />
        </button>
        <div className="nav-rail__footer-meta">
          <DesktopUpdateIndicator />
          <NavRailVersion />
        </div>
      </div>
    </nav>
  );
}