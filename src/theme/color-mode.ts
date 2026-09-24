import { RAW_COLORS } from "./raw-colors";

/**
 * Colour-mode plumbing, shared by the pre-paint script and the React provider.
 *
 * Deliberately free of React and of Chakra, for two reasons: the no-flash script has to
 * run as a string in `<head>` before any bundle loads, and `tests/` needs to assert on the
 * same resolution rules the script uses without rendering anything.
 *
 * ## Why this is hand-rolled rather than `next-themes`
 *
 * Chakra v3's own documentation reaches for `next-themes`, and it is a reasonable library.
 * It was not added here because the whole requirement is about 70 lines — a class on
 * `<html>`, a `localStorage` key, a `matchMedia` listener and a blocking script — and this
 * project has an established preference for owning small pieces of infrastructure rather
 * than taking a dependency for them (see the hand-written service worker and the PNG
 * encoder in `scripts/generate-icons.ts`). Two things here are also project-specific enough
 * that a general library would need configuring around them anyway: the `theme-color` meta
 * handling in `applyColorMode()` (see 3.4 of the group 24 update document) and the
 * deliberate absence of a "system" position on the toggle.
 *
 * If the requirements grow — per-route themes, a third mode, SSR-resolved modes — reach for
 * the library rather than growing this file.
 */

/** What the user has chosen. Absence means "follow the operating system". */
export type ColorModePreference = "light" | "dark";

/** What is actually rendered. Always one of two things. */
export type ColorMode = "light" | "dark";

/**
 * `localStorage` key.
 *
 * Namespaced, because the app shares an origin with nothing but is inspected by hand often
 * enough that a bare `theme` would be ambiguous.
 */
export const COLOR_MODE_STORAGE_KEY = "expense-tracker-color-mode";

/**
 * The class Chakra's `_dark` condition looks for.
 *
 * Verified against the resolved system config, not assumed:
 *
 *     conditions.dark === ".dark &, .dark .chakra-theme:not(.light) &"
 *
 * Both selectors need `.dark` to be an **ancestor**, which is why the class goes on
 * `<html>` rather than on `<body>` or on a wrapper inside the tree.
 */
export const DARK_CLASS = "dark";

/** Present on `<html>` in light mode. Nothing reads it; it exists for `:not(.light)`. */
export const LIGHT_CLASS = "light";

/** The `theme-color` value per mode — the page background, not the card surface. */
export const THEME_COLOR: Record<ColorMode, string> = {
  light: RAW_COLORS.surface,
  dark: RAW_COLORS.darkSurface,
};

export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

/** Narrows an unknown stored value. Anything else is treated as "no preference". */
export function parsePreference(value: unknown): ColorModePreference | null {
  return value === "light" || value === "dark" ? value : null;
}

/**
 * Reads the stored preference.
 *
 * Returns `null` on any failure rather than throwing. `localStorage` access throws in
 * Safari private browsing and when a browser blocks storage for the origin, and a theme
 * preference is not worth taking the app down for.
 */
export function readStoredPreference(): ColorModePreference | null {
  try {
    return parsePreference(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Writes the preference, ignoring storage failures for the same reason as above. */
export function writeStoredPreference(preference: ColorModePreference): void {
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, preference);
  } catch {
    // A preference that cannot be persisted still applies for this session.
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(PREFERS_DARK_QUERY).matches;
  } catch {
    // `matchMedia` is missing in some embedded webviews and in jsdom without a stub.
    return false;
  }
}

/** An explicit choice wins; otherwise the operating system decides. */
export function resolveColorMode(preference: ColorModePreference | null): ColorMode {
  if (preference) return preference;
  return systemPrefersDark() ? "dark" : "light";
}

/**
 * Puts a resolved mode onto the document.
 *
 * Three separate effects, and all three are needed:
 *
 * 1. **The class**, which is what activates every `_dark` token.
 * 2. **`color-scheme`**, which is what makes the browser's own furniture follow — scrollbars,
 *    the caret, `<select>` dropdown panels, form-control defaults. Without it a dark page
 *    gets a light scrollbar and native selects open a white list, which is exactly where a
 *    hand-rolled dark mode usually gives itself away. It matters more here than in most
 *    apps because this design deliberately keeps native `<select>` elements (7.2).
 * 3. **Every `theme-color` meta tag**, which is the browser chrome and the colour flashed
 *    before first paint.
 *
 * Writing to *every* `theme-color` meta rather than one is deliberate; see the group 24
 * update document, section 3.4.
 */
export function applyColorMode(mode: ColorMode, root: HTMLElement, doc: Document): void {
  root.classList.toggle(DARK_CLASS, mode === "dark");
  root.classList.toggle(LIGHT_CLASS, mode === "light");
  root.style.colorScheme = mode;

  const themeColor = THEME_COLOR[mode];
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", themeColor);
  }
}

/**
 * The script that runs before first paint.
 *
 * Built as a string because it has to be inlined into `<head>` and executed synchronously.
 * A `useEffect` cannot do this job: effects run after the first paint, so the user would
 * see a light page for a frame and then watch it go dark — the "flash of wrong theme". On a
 * dark-mode phone at night that flash is genuinely unpleasant, not merely untidy.
 *
 * It duplicates a little of the logic above, and that is the correct trade. Importing from
 * this module would mean loading a bundle first, which is precisely the wait the script
 * exists to avoid. The duplication is bounded (the key, the two class names, the two
 * colours) and every value is interpolated from the exports above rather than retyped, so
 * there is one source for each.
 *
 * Wrapped in try/catch because it runs before React, before error boundaries, and before
 * the service worker. A throw here would be an unstyled blank page.
 */
export function colorModeScriptSource(): string {
  return `(function(){try{
var k=${JSON.stringify(COLOR_MODE_STORAGE_KEY)};
var s=null;try{s=window.localStorage.getItem(k)}catch(e){}
var m=s==="light"||s==="dark"?s:(window.matchMedia&&window.matchMedia(${JSON.stringify(
    PREFERS_DARK_QUERY,
  )}).matches?"dark":"light");
var r=document.documentElement;
r.classList.toggle(${JSON.stringify(DARK_CLASS)},m==="dark");
r.classList.toggle(${JSON.stringify(LIGHT_CLASS)},m==="light");
r.style.colorScheme=m;
var c=m==="dark"?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)};
var t=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<t.length;i++){t[i].setAttribute("content",c)}
}catch(e){}})();`;
}
