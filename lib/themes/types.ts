/**
 * Forge skin model — aligned with Hermes Desktop `DesktopTheme` so presets
 * and user-installed themes can be shared between products.
 */

export interface SkinColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  midground?: string;
  midgroundForeground?: string;
  composerRing?: string;
  destructive: string;
  destructiveForeground: string;
  sidebarBackground?: string;
  sidebarBorder?: string;
  userBubble?: string;
  userBubbleBorder?: string;
}

export interface SkinTypography {
  fontSans: string;
  fontMono: string;
  fontUrl?: string;
}

export interface ForgeSkin {
  name: string;
  label: string;
  description: string;
  colors: SkinColors;
  darkColors?: SkinColors;
  typography?: Partial<SkinTypography>;
}

/** CSS custom properties written by applySkin onto <html>. */
export type ForgeSkinVars = Record<string, string>;