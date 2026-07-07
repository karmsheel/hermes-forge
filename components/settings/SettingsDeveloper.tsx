"use client";

import { Code } from "lucide-react";
import { ListRow } from "@/components/ui";
import { useDeveloperSettings } from "./DeveloperSettingsProvider";

export function SettingsDeveloper() {
  const {
    previewUpdateIcon,
    setPreviewUpdateIcon,
    showCronalyticsPage,
    setShowCronalyticsPage,
    showDecisionsPage,
    setShowDecisionsPage,
    showHomeProcessStandardPicker,
    setShowHomeProcessStandardPicker,
  } = useDeveloperSettings();

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center">
          <Code className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Developer</h2>
          <p className="text-xs text-text-soft">Preview and test in-progress features</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="divide-y divide-border-soft">
          <div className="py-1">
            <ListRow
              label="Show home notation picker"
              description='Reveal the process standard control in the home composer (BPMN, swimlane, flowchart). Hidden by default; "Model picks" stays the default.'
              action={
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHomeProcessStandardPicker}
                    onChange={(event) => setShowHomeProcessStandardPicker(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                </label>
              }
            />
          </div>
          <div className="py-1">
            <ListRow
              label="Show Decisions page"
              description="Reveal the Decisions nav item and page. Hidden by default."
              action={
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDecisionsPage}
                    onChange={(event) => setShowDecisionsPage(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                </label>
              }
            />
          </div>
          <div className="py-1">
            <ListRow
              label="Show Cronalytics page"
              description="Reveal the Cronalytics nav item and page. Hidden by default."
              action={
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCronalyticsPage}
                    onChange={(event) => setShowCronalyticsPage(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                </label>
              }
            />
          </div>
          <div className="py-1">
            <ListRow
              label="Testing update icon"
              description="Show the desktop update badge and dialog with mock data for UI testing."
              action={
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewUpdateIcon}
                    onChange={(event) => setPreviewUpdateIcon(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                </label>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}