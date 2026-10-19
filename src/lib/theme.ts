// No React imports here: the root layout (a Server Component) uses THEME_INIT_SCRIPT.
import type { ThemePref } from "./prefs";
import { STORAGE_KEYS } from "./storageKeys";

/** Browser-chrome colours; keep in sync with --c-canvas in globals.css. */
export const THEME_COLORS = { light: "#f8f6f2", dark: "#0e0c0b" } as const;

export type ResolvedTheme = keyof typeof THEME_COLORS;

export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Applies the theme class, native color-scheme and status-bar colour. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", THEME_COLORS[theme]);
  });
}

/**
 * Inline <head> script: applies the saved theme before first paint so there is
 * never a light flash in dark mode. Must stay dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.prefs,
)})||"null");var t=p&&p.theme;if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var r=document.documentElement;if(t==="dark")r.classList.add("dark");r.style.colorScheme=t;}catch(e){}})();`;
