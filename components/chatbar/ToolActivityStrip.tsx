"use client";

import { Loader2, Wrench } from "lucide-react";
import type { ToolActivity } from "@/lib/chatbar/runtime-events";

interface ToolActivityStripProps {
  activities: readonly ToolActivity[];
  /** When true, strip stays visible even if all tools completed (during stream). */
  active?: boolean;
}

function isRunning(status: string): boolean {
  return !/^(completed|finished|done|success|error|failed)$/i.test(status);
}

/**
 * Structured tool activity UI while Hermes streams (extension Tool Activity Strip parity).
 */
export function ToolActivityStrip({ activities, active = false }: ToolActivityStripProps) {
  if (!activities.length) return null;

  const visible = activities.filter(
    (a) => active || isRunning(a.status) || activities.indexOf(a) >= activities.length - 3,
  );
  if (!visible.length) return null;

  return (
    <div className="tool-activity-strip" role="status" aria-live="polite" aria-label="Tool activity">
      <div className="tool-activity-strip__header">
        <Wrench className="w-3 h-3" aria-hidden />
        <span>Tools</span>
      </div>
      <ul className="tool-activity-strip__list">
        {visible.map((activity) => {
          const running = isRunning(activity.status);
          return (
            <li
              key={activity.activityId}
              className={`tool-activity tool-activity--${activity.category}${running ? " is-running" : " is-done"}`}
            >
              <div className="tool-activity__head">
                <span
                  className={`tool-activity__glyph tool-activity__glyph--${activity.category}`}
                  aria-hidden
                />
                <span className="tool-activity__label">{activity.label}</span>
                <span className="tool-activity__name">{activity.rawName}</span>
                {running ? (
                  <Loader2 className="tool-activity__spinner w-3 h-3 animate-spin" aria-hidden />
                ) : (
                  <span className="tool-activity__status" aria-label={activity.status}>
                    ✓
                  </span>
                )}
              </div>
              {activity.preview ? (
                <div className="tool-activity__preview">{activity.preview}</div>
              ) : null}
              {running ? (
                <div className="tool-activity__meter" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
