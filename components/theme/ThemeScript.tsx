import { ACCENT_IDS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "@/lib/accent";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to avoid theme / accent flash on load. */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else if(t==='system'){document.documentElement.removeAttribute('data-theme');}else{document.documentElement.setAttribute('data-theme','dark');}var ak=${JSON.stringify(ACCENT_STORAGE_KEY)};var aids=${JSON.stringify(ACCENT_IDS)};var a=localStorage.getItem(ak);if(!a||aids.indexOf(a)<0){a=${JSON.stringify(DEFAULT_ACCENT)};}document.documentElement.setAttribute('data-accent',a);}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-accent',${JSON.stringify(DEFAULT_ACCENT)});}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}