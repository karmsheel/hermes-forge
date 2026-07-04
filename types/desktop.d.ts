export {};

declare global {
  interface Window {
    forgeDesktop?: {
      isDesktop: boolean;
      platform: string;
      openVscodeThemeFile?: () => Promise<string | null>;
    };
  }
}