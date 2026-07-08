"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_EMOJI_OPTIONS,
  BUSINESS_ICON_KEYS,
  type BusinessIconKey,
  resolveBusinessIcon,
} from "@/lib/business-avatar";

type AvatarTab = "emoji" | "icon";

interface BusinessAvatarPickerFieldsProps {
  avatarEmoji: string | null;
  avatarIcon: string | null;
  disabled?: boolean;
  onSelectEmoji: (emoji: string) => void;
  onSelectIcon: (iconKey: BusinessIconKey) => void;
  onClear: () => void;
}

export function BusinessAvatarPickerFields({
  avatarEmoji,
  avatarIcon,
  disabled = false,
  onSelectEmoji,
  onSelectIcon,
  onClear,
}: BusinessAvatarPickerFieldsProps) {
  const [tab, setTab] = useState<AvatarTab>("emoji");

  useEffect(() => {
    setTab(avatarEmoji ? "emoji" : avatarIcon ? "icon" : "emoji");
  }, [avatarEmoji, avatarIcon]);

  return (
    <div className="business-avatar-picker-fields">
      <div className="business-avatar-picker__tabs" role="tablist" aria-label="Avatar type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "emoji"}
          className={`business-avatar-picker__tab${tab === "emoji" ? " is-active" : ""}`}
          onClick={() => setTab("emoji")}
          disabled={disabled}
        >
          Emoji
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "icon"}
          className={`business-avatar-picker__tab${tab === "icon" ? " is-active" : ""}`}
          onClick={() => setTab("icon")}
          disabled={disabled}
        >
          Icon
        </button>
      </div>

      {tab === "emoji" ? (
        <div className="business-avatar-picker__grid business-avatar-picker__grid--emoji" role="list">
          {BUSINESS_EMOJI_OPTIONS.map((emoji) => {
            const isActive = avatarEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                role="listitem"
                className={`business-avatar-picker__emoji${isActive ? " is-active" : ""}`}
                onClick={() => onSelectEmoji(emoji)}
                disabled={disabled}
                aria-label={`Use ${emoji} emoji`}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="business-avatar-picker__grid business-avatar-picker__grid--icon" role="list">
          {BUSINESS_ICON_KEYS.map((key) => {
            const Icon = resolveBusinessIcon(key)!;
            const isActive = avatarIcon === key;
            return (
              <button
                key={key}
                type="button"
                role="listitem"
                className={`business-avatar-picker__icon${isActive ? " is-active" : ""}`}
                onClick={() => onSelectIcon(key)}
                disabled={disabled}
                aria-label={`Use ${key} icon`}
                title={key}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      )}

      <div className="business-avatar-picker-fields__footer">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || (!avatarEmoji && !avatarIcon)}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          Use initial
        </button>
      </div>
    </div>
  );
}