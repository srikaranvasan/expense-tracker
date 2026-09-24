"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  PREFERS_DARK_QUERY,
  applyColorMode,
  readStoredPreference,
  resolveColorMode,
  writeStoredPreference,
} from "@/theme/color-mode";
import type { ColorMode, ColorModePreference } from "@/theme/color-mode";

export type ColorModeContextValue = {
  /** What is rendered right now. */
  colorMode: ColorMode;
  /** What the user chose, or `null` when following the operating system. */
  preference: ColorModePreference | null;
  setColorMode: (mode: ColorModePreference) => void;
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

/**
 * Owns the colour mode for the whole application.
 *
 * ## Why the initial state is read synchronously
 *
 * `useState(() => resolveColorMode(readStoredPreference()))` runs during render, not in an
 * effect. That matters because `ColorModeScript` has already put the class on `<html>`
 * before this component mounts: if the provider started from a hard-coded `"light"` and
 * corrected itself in an effect, the toggle would render the wrong icon for one frame and
 * any component reading `colorMode` would briefly disagree with the document.
 *
 * On the server both `localStorage` and `matchMedia` are absent, so the initialiser is
 * guarded and resolves to `"light"`. That is a real limitation rather than a bug being
 * hidden — see section 6 of the group 24 update document. Nothing in the tree renders
 * differently per mode on the server; the colours come from CSS, which the class already
 * selects.
 *
 * ## Why the preference is two-state, not three
 *
 * There is no "system" position. An unset preference means "follow the system", so that is
 * the state every user starts in, but choosing explicitly is one-way. A three-position
 * control needs a label to be comprehensible, and group 21 put this in the app header —
 * where a wide labelled control is the thing that caused the crushed-title bug this restyle
 * has to fix (9.2). Recorded as a known gap.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ColorModePreference | null>(() =>
    typeof window === "undefined" ? null : readStoredPreference(),
  );

  const [colorMode, setResolvedMode] = useState<ColorMode>(() =>
    typeof window === "undefined" ? "light" : resolveColorMode(readStoredPreference()),
  );

  /*
   * Keeps the document in step with the resolved mode.
   *
   * Runs on mount too, which is a deliberate no-op in the normal case: the script already
   * applied the same values, so `classList.toggle` and `setAttribute` write what is already
   * there. It is the path that makes the provider correct when the script did not run —
   * a test, a Storybook-like harness, or a browser that blocked the inline script.
   */
  useEffect(() => {
    applyColorMode(colorMode, document.documentElement, document);
  }, [colorMode]);

  /*
   * Follows the operating system while no explicit preference exists.
   *
   * Without this, a user who has never touched the toggle would stay on whatever mode the
   * OS was in when the tab opened — so an automatic switch at sunset would leave the app
   * light until a reload. The listener is removed as soon as a preference is set, which is
   * what makes an explicit choice actually stick.
   */
  useEffect(() => {
    if (preference !== null) return;

    let query: MediaQueryList;
    try {
      query = window.matchMedia(PREFERS_DARK_QUERY);
    } catch {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setResolvedMode(event.matches ? "dark" : "light");
    };

    // Re-read on subscribe: the OS may have changed between the initial render and here.
    setResolvedMode(query.matches ? "dark" : "light");
    query.addEventListener("change", handleChange);

    return () => query.removeEventListener("change", handleChange);
  }, [preference]);

  const setColorMode = useCallback((mode: ColorModePreference) => {
    setPreference(mode);
    setResolvedMode(mode);
    writeStoredPreference(mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === "dark" ? "light" : "dark");
  }, [colorMode, setColorMode]);

  const value = useMemo<ColorModeContextValue>(
    () => ({ colorMode, preference, setColorMode, toggleColorMode }),
    [colorMode, preference, setColorMode, toggleColorMode],
  );

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

/**
 * Reads the colour mode.
 *
 * Throws when the provider is missing rather than returning a default. A silent `"light"`
 * would make the toggle a button that does nothing, which is far harder to diagnose than a
 * clear error at the point of use.
 */
export function useColorMode(): ColorModeContextValue {
  const value = useContext(ColorModeContext);

  if (!value) {
    throw new Error("useColorMode must be used inside <ColorModeProvider>.");
  }

  return value;
}
