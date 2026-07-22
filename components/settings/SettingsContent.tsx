"use client";

import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { getSettingsSections, type SettingsViewId } from "@/lib/settings-views";
import { useDeveloperSettings } from "./DeveloperSettingsProvider";
import { SettingsAbout } from "./SettingsAbout";
import { SettingsAgentPrompts } from "./SettingsAgentPrompts";
import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsDeveloper } from "./SettingsDeveloper";

function SettingsNavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
        active
          ? "border-accent-soft bg-accent-tint font-medium text-accent"
          : "border-transparent text-text-muted hover:bg-bg-subtle hover:text-text",
      ].join(" ")}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function SettingsPanel({ view }: { view: SettingsViewId }) {
  switch (view) {
    case "appearance":
      return <SettingsAppearance />;
    case "agent-prompts":
      return <SettingsAgentPrompts />;
    case "about":
      return <SettingsAbout />;
    case "developer":
      return <SettingsDeveloper />;
    default:
      return <SettingsAppearance />;
  }
}

export function SettingsContent({
  activeView,
  onViewChange,
}: {
  activeView: SettingsViewId;
  onViewChange: (view: SettingsViewId) => void;
}) {
  const { isUnlocked } = useDeveloperSettings();
  const sections = useMemo(() => getSettingsSections(isUnlocked), [isUnlocked]);

  useEffect(() => {
    if (activeView === "developer" && !isUnlocked) {
      onViewChange("appearance");
    }
  }, [activeView, isUnlocked, onViewChange]);

  const navGroups = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        active: activeView === section.id,
        onSelect: () => onViewChange(section.id),
      })),
    [sections, activeView, onViewChange]
  );

  const segmentedOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: section.id,
        label: section.label,
        icon: <section.icon className="w-3.5 h-3.5 shrink-0" />,
      })),
    [sections]
  );

  return (
    <div className="settings-overlay__layout settings-overlay__layout--split">
      <aside className="settings-overlay__nav" aria-label="Settings sections">
        <div className="settings-overlay__nav-header">
          <div className="text-xs uppercase tracking-widest text-text-muted">App</div>
          <h2 className="text-lg font-semibold tracking-tight mt-1">Settings</h2>
        </div>
        <nav className="settings-overlay__nav-list">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.gapBefore ? <div className="h-2" aria-hidden /> : null}
              <SettingsNavItem
                active={group.active}
                icon={group.icon}
                label={group.label}
                onClick={group.onSelect}
              />
            </div>
          ))}
        </nav>
      </aside>

      <div className="settings-overlay__mobile-nav">
        <SegmentedControl
          value={activeView}
          options={segmentedOptions}
          ariaLabel="Settings section"
          onChange={onViewChange}
        />
      </div>

      <main className="settings-overlay__main">
        <div className="settings-overlay__main-scroll">
          <SettingsPanel view={activeView} />
        </div>
      </main>
    </div>
  );
}