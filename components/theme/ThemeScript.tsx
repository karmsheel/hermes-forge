import { getThemeBootScript } from "@/lib/themes/boot-script";

/** Runs before paint to avoid theme / skin flash on load. */
export function ThemeScript() {
  const script = getThemeBootScript();
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}