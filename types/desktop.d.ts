import type { DesktopUpdateStatus } from "@/lib/desktop-update-types";

export {};

declare global {
  interface Window {
    forgeDesktop?: {
      isDesktop: boolean;
      platform: string;
      getAppVersion?: () => Promise<string>;
      openVscodeThemeFile?: () => Promise<string | null>;
      getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
      checkForUpdates?: () => Promise<DesktopUpdateStatus>;
      downloadUpdate?: () => Promise<DesktopUpdateStatus>;
      installUpdate?: () => void;
      onUpdateStatus?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
      window?: {
        minimize: () => Promise<void>;
        maximizeToggle: () => Promise<boolean>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
      };
    };
  }
}
