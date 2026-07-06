"use client";

import { useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { SettingsContent } from "./SettingsContent";
import type { SettingsViewId } from "@/lib/settings-views";

export function SettingsOverlay({
  open,
  activeView,
  onViewChange,
  onClose,
}: {
  open: boolean;
  activeView: SettingsViewId;
  onViewChange: (view: SettingsViewId) => void;
  onClose: () => void;
}) {

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="settings-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="settings-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-overlay-title"
      >
        <div className="settings-overlay__chrome">
          <h2 id="settings-overlay-title" className="sr-only">
            Settings
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="settings-overlay__close"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <SettingsContent activeView={activeView} onViewChange={onViewChange} />
      </div>
    </div>
  );
}

