import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import {
  COLOR_MODE_STORAGE_KEY,
  DARK_CLASS,
  LIGHT_CLASS,
  THEME_COLOR,
  applyColorMode,
  colorModeScriptSource,
  parsePreference,
  resolveColorMode,
} from "@/theme/color-mode";
import { system } from "@/theme";
import { useColorMode } from "./ColorModeProvider";
import { ColorModeToggle } from "./ColorModeToggle";

/**
 * Tests for the colour-mode infrastructure.
 *
 * Four things are worth testing here, and they are not the obvious ones:
 *
 *   1. the resolution rules — an explicit preference beats the operating system
 *   2. that the mode reaches the **document**, because a class on `<html>` is the only
 *      mechanism by which any `_dark` token activates
 *   3. that the pre-paint script and the provider agree, since they duplicate logic
 *   4. that storage failures degrade rather than throw
 *
 * What is *not* tested here is whether a dark screen looks right. That needs a browser and a
 * human; it is recorded in section 5 of the group 24 update document.
 */

/** jsdom has no `matchMedia`, so every test installs one with a known answer. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const query = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );

  return {
    /** Simulates the operating system switching mode while the app is open. */
    emit(matches: boolean) {
      query.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

function ModeProbe() {
  const { colorMode, preference, setColorMode } = useColorMode();

  return (
    <div>
      <output data-testid="mode">{colorMode}</output>
      <output data-testid="preference">{preference ?? "system"}</output>
      <button type="button" onClick={() => setColorMode("dark")}>
        go dark
      </button>
      <button type="button" onClick={() => setColorMode("light")}>
        go light
      </button>
    </div>
  );
}

const clickButton = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("colour mode", () => {
  /**
   * Replaces only the `theme-color` tags.
   *
   * Emphatically **not** `document.head.innerHTML = …`: Chakra's style engine injects
   * `<style>` elements into the head and keeps references to them, so wiping it makes the
   * next unmount throw "The child can not be found in the parent" — several tests after the
   * one that caused it.
   */
  function resetThemeColorMeta(html: string) {
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
    document.head.insertAdjacentHTML("afterbegin", html);
  }

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    resetThemeColorMeta('<meta name="theme-color" content="#000000" />');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  describe("resolution rules", () => {
    it("follows the operating system when nothing is stored", () => {
      stubMatchMedia(true);
      expect(resolveColorMode(null)).toBe("dark");

      stubMatchMedia(false);
      expect(resolveColorMode(null)).toBe("light");
    });

    it("lets an explicit preference win over the operating system", () => {
      // The whole point of a toggle: a user on a dark phone who wants the app light.
      stubMatchMedia(true);
      expect(resolveColorMode("light")).toBe("light");

      stubMatchMedia(false);
      expect(resolveColorMode("dark")).toBe("dark");
    });

    it("treats anything unrecognised in storage as no preference", () => {
      // A stale value from an earlier scheme, or a hand-edited key, must not wedge the app
      // into an invalid mode.
      expect(parsePreference("sepia")).toBeNull();
      expect(parsePreference("")).toBeNull();
      expect(parsePreference(null)).toBeNull();
      expect(parsePreference(undefined)).toBeNull();
      expect(parsePreference("dark")).toBe("dark");
    });

    it("falls back to light when matchMedia is unavailable", () => {
      // Some embedded webviews have no matchMedia at all. Throwing there would take the whole
      // app down over a colour preference.
      vi.stubGlobal("matchMedia", undefined);
      expect(resolveColorMode(null)).toBe("light");
    });
  });

  describe("applying a mode to the document", () => {
    it("puts the dark class on the element Chakra's condition looks for", () => {
      applyColorMode("dark", document.documentElement, document);

      /*
       * Chakra's resolved `dark` condition is ".dark &, .dark .chakra-theme:not(.light) &".
       * Both selectors need `.dark` on an ancestor, so this class on <html> is the entire
       * mechanism by which forty `_dark` token values activate. If it landed on <body> or on a
       * wrapper div instead, nothing would error and nothing would change colour.
       */
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
      expect(document.documentElement.classList.contains(LIGHT_CLASS)).toBe(false);
    });

    it("marks light mode explicitly too, for the :not(.light) half of the condition", () => {
      applyColorMode("light", document.documentElement, document);

      expect(document.documentElement.classList.contains(LIGHT_CLASS)).toBe(true);
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
    });

    it("sets color-scheme so the browser's own furniture follows", () => {
      // Scrollbars, the caret and native <select> panels. This design keeps native selects
      // deliberately (7.2), so a dark page with a white dropdown list is a visible failure.
      applyColorMode("dark", document.documentElement, document);
      expect(document.documentElement.style.colorScheme).toBe("dark");

      applyColorMode("light", document.documentElement, document);
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("rewrites every theme-color meta tag, not just the first", () => {
      // The layout emits a media-qualified pair. Whichever one the browser selects must carry
      // the resolved colour, or an explicit override shows the wrong browser chrome.
      resetThemeColorMeta(
        '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FFFFFF" />' +
          '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#FFFFFF" />',
      );

      applyColorMode("dark", document.documentElement, document);

      const contents = [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
        meta.getAttribute("content"),
      );
      expect(contents).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    });

    it("uses the page background, not the card surface", () => {
      // The colour flashed before first paint should be the colour of the page, or it is still
      // a flash.
      expect(THEME_COLOR.light).toBe("#FAF7F2");
      expect(THEME_COLOR.dark).toBe("#141220");
    });
  });

  describe("the provider", () => {
    it("renders in light mode when the system prefers light", () => {
      stubMatchMedia(false);

      renderWithProviders(<ModeProbe />);

      expect(screen.getByTestId("mode")).toHaveTextContent("light");
      expect(screen.getByTestId("preference")).toHaveTextContent("system");
    });

    it("renders in dark mode when the system prefers dark", async () => {
      stubMatchMedia(true);

      renderWithProviders(<ModeProbe />);

      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("dark"));
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    });

    it("renders in dark mode when dark is stored, whatever the system says", async () => {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, "dark");
      stubMatchMedia(false);

      renderWithProviders(<ModeProbe />);

      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("dark"));
      expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    });

    it("persists an explicit choice", async () => {
      stubMatchMedia(false);
      renderWithProviders(<ModeProbe />);

      clickButton("go dark");

      await waitFor(() => expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe("dark"));
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    });

    it("follows the system while no preference is set", async () => {
      const media = stubMatchMedia(false);
      renderWithProviders(<ModeProbe />);

      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("light"));

      // The OS switches at sunset. Without the listener the app would stay light until a
      // reload.
      media.emit(true);

      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("dark"));
    });

    it("stops following the system once a choice is made", async () => {
      const media = stubMatchMedia(false);
      renderWithProviders(<ModeProbe />);

      clickButton("go light");
      await waitFor(() => expect(screen.getByTestId("preference")).toHaveTextContent("light"));

      media.emit(true);

      // An explicit choice the operating system can override is not a choice.
      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("light"));
    });

    it("keeps working when storage throws", async () => {
      // Safari private browsing, and any origin where the browser has blocked storage.
      stubMatchMedia(false);
      const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });

      renderWithProviders(<ModeProbe />);
      clickButton("go dark");

      // The mode still applies for this session; only persistence is lost.
      await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("dark"));
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);

      setItem.mockRestore();
    });

    it("fails loudly when the provider is missing", () => {
      // A silent default would make the toggle a button that does nothing, which is far harder
      // to diagnose than an error at the point of use.
      stubMatchMedia(false);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        render(
          <ChakraProvider value={system}>
            <ModeProbe />
          </ChakraProvider>,
        ),
      ).toThrow(/ColorModeProvider/);

      consoleError.mockRestore();
    });
  });

  describe("the toggle", () => {
    it("switches the document from light to dark and back", async () => {
      stubMatchMedia(false);
      renderWithProviders(<ColorModeToggle />);

      const toggle = screen.getByRole("button", { name: "Dark theme" });
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
        expect(toggle).toHaveAttribute("aria-pressed", "true");
      });

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(document.documentElement.classList.contains(LIGHT_CLASS)).toBe(true);
        expect(toggle).toHaveAttribute("aria-pressed", "false");
      });
    });

    it("has an accessible name even though it shows no text", async () => {
      stubMatchMedia(false);
      renderWithProviders(<ColorModeToggle />);

      const toggle = await screen.findByRole("button", { name: "Dark theme" });
      expect(toggle).toHaveAttribute("title", "Dark theme");
    });

    it("renders both glyphs so the markup does not depend on the mode", () => {
      /*
       * Hydration safety. The server cannot know the user's mode — no localStorage, no
       * matchMedia — so choosing the glyph in JavaScript would mismatch on every dark-mode
       * visit. Both are rendered and CSS picks one, which also means the correct glyph is
       * showing before React loads.
       */
      stubMatchMedia(false);
      const { container } = renderWithProviders(<ColorModeToggle />);

      expect(container.querySelectorAll("svg")).toHaveLength(2);
    });

    it("hides both glyphs from assistive technology", () => {
      stubMatchMedia(false);
      const { container } = renderWithProviders(<ColorModeToggle />);

      for (const svg of container.querySelectorAll("svg")) {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      }
    });

    it("meets the minimum touch target", () => {
      // An icon-only control is easy to draw too small. 44px is the project minimum
      // (docs/06-CODING-PRACTICES.md section 40).
      stubMatchMedia(false);
      renderWithProviders(<ColorModeToggle />);

      const toggle = screen.getByRole("button", { name: "Dark theme" });
      const styles = window.getComputedStyle(toggle);
      expect(styles.minWidth).toBe("var(--chakra-sizes-touch)");
      expect(styles.minHeight).toBe("var(--chakra-sizes-touch)");
    });
  });

  describe("the pre-paint script", () => {
    /*
     * The script duplicates the resolution logic because it must run before any bundle loads.
     * These tests are what keep the duplicate honest — the script is executed for real,
     * against the same document the provider would touch.
     */
    const run = () => {
      // Executing the shipped string is the point: a reimplementation in the test would be the
      // thing under test, and the script would be the thing that breaks.
      new Function(colorModeScriptSource())();
    };

    it("applies dark before React runs when dark is stored", () => {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, "dark");
      stubMatchMedia(false);

      run();

      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        THEME_COLOR.dark,
      );
    });

    it("applies the system preference when nothing is stored", () => {
      stubMatchMedia(true);

      run();

      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    });

    it("agrees with the provider on the storage key and the class names", () => {
      const source = colorModeScriptSource();

      // The duplication is bounded, and every value is interpolated from the same constants
      // the provider imports. This asserts that stayed true.
      expect(source).toContain(JSON.stringify(COLOR_MODE_STORAGE_KEY));
      expect(source).toContain(JSON.stringify(DARK_CLASS));
      expect(source).toContain(JSON.stringify(LIGHT_CLASS));
      expect(source).toContain(JSON.stringify(THEME_COLOR.dark));
      expect(source).toContain(JSON.stringify(THEME_COLOR.light));
    });

    it("does not throw when storage and matchMedia are both unavailable", () => {
      vi.stubGlobal("matchMedia", undefined);
      const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });

      // It runs before React, before any error boundary and before the service worker. A
      // throw here is an unstyled blank page.
      expect(run).not.toThrow();
      expect(document.documentElement.classList.contains(LIGHT_CLASS)).toBe(true);

      getItem.mockRestore();
    });
  });
});
