"use client";

import { useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { ProfileContent } from "./ProfileContent";

/**
 * Compact profile modal — account name + sign-in only.
 * Same dismiss pattern as Settings (backdrop / Escape / close).
 */
export function ProfileOverlay({
  open,
  onClose,
}: {
  open: boolean;
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
      className="settings-overlay settings-overlay--profile"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="settings-overlay__panel settings-overlay__panel--profile"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-overlay-title"
      >
        <div className="settings-overlay__chrome">
          <h2 id="profile-overlay-title" className="sr-only">
            Profile
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="settings-overlay__close"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ProfileContent />
      </div>
    </div>
  );
}
