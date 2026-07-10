"use client";

import Link from "next/link";
import { HermesForgeMark } from "@/components/brand/HermesForgeMark";
import { usePathname } from "next/navigation";
import {
  Clock,
  FolderKanban,
  Hammer,
  Home,
  MessageSquare,
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
import { NavRailVersion } from "./NavRailVersion";
import { NavThemeModeToggle } from "./NavThemeModeToggle";
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
  const { isOpen: chatOpen, toggle: toggleChat } = useChatbar();
  const { showCronalyticsPage, showDecisionsPage, showGodModePage } = useDeveloperSettings();

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
      </div>

      <div className="nav-rail__section nav-rail__section--grow">
        {mainItems
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
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>

      <div className="nav-rail__section nav-rail__section--footer">
        <NavThemeModeToggle />
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