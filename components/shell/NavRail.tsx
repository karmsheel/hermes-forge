"use client";

import Image from "next/image";
import Link from "next/link";
import iconImage from "@/assets/icon.jpg";
import { usePathname } from "next/navigation";
import {
  Clock,
  FolderKanban,
  Hammer,
  Home,
  LayoutDashboard,
  PlugZap,
  Plus,
  ScrollText,
  User,
  Zap,
} from "lucide-react";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
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
      id: "workshop",
      href: "/workshop",
      label: "Workshop",
      icon: Hammer,
      match: (path) => path.startsWith("/workshop"),
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
        <Link href="/home" className="nav-rail__logo" title="Hermes Forge">
          <Image
            src={iconImage}
            alt="Hermes Forge"
            className="nav-rail__logo-mark"
            width={36}
            height={36}
            priority
          />
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
        {mainItems.map((item) => {
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
        <div className="nav-rail__settings-wrap">
          <SettingsMenu className="nav-rail__settings" />
        </div>
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
      </div>
    </nav>
  );
}