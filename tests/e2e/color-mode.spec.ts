import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { RAW_COLORS } from "../../src/theme/raw-colors";

/**
 * Colour mode in a real browser.
 *
 * Three of group 24's claims cannot be checked anywhere else:
 *
 *   - `_dark` tokens actually activate, which depends on Chakra's resolved condition
 *     (`.dark &, .dark .chakra-theme:not(.light) &`) matching the class the app sets
 *   - there is **no flash of the wrong theme**, which is about ordering within a single
 *     paint and is invisible to jsdom
 *   - `prefers-color-scheme` is honoured on a first visit
 *
 * The sign-in page is used deliberately: it needs no session or seeded data, and group 21
 * decided the unauthenticated layout follows the system preference only. What is asserted
 * here is the page background, which is `surface.muted` — a token, so it proves the whole
 * chain from class to CSS variable to computed colour.
 */

/** `#141220` and `#FAF7F2` as the browser reports them. */
const DARK_PAGE = "rgb(20, 18, 32)";
const LIGHT_PAGE = "rgb(250, 247, 242)";

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("colour mode", () => {
  test.use({ colorScheme: "light" });

  test("renders light when the operating system prefers light", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    expect(await bodyBackground(page)).toBe(LIGHT_PAGE);
  });

  test("stores an explicit preference and honours it over the system", async ({ page }) => {
    await page.goto("/login");

    // Written the way the app writes it. The point is that a stored value beats the light
    // system preference this project is configured with.
    await page.evaluate(() => localStorage.setItem("expense-tracker-color-mode", "dark"));
    await page.reload();

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await bodyBackground(page)).toBe(DARK_PAGE);
  });

  test("paints dark on the very first frame, with no flash of light", async ({ page }) => {
    /*
     * The failure this guards against is ordering, not correctness: with the mode applied in
     * an effect instead of a blocking script, the page renders light for one frame and then
     * goes dark. Every assertion about the final state still passes.
     *
     * `addInitScript` runs before the document's own scripts, so the observer is watching
     * before the inline script executes. It records the class on <html> the first time the
     * documentElement is touched, which is the closest a test can get to "what was true at
     * first paint".
     */
    await page.addInitScript(() => {
      localStorage.setItem("expense-tracker-color-mode", "dark");

      const readings: string[] = [];
      (window as unknown as { __classReadings: string[] }).__classReadings = readings;

      /*
       * Observed on `document`, with `subtree`, rather than on `document.documentElement`.
       *
       * At init-script time `documentElement` is still null — the parser has not created
       * <html> yet — so observing it throws and the observer is never installed. That mistake
       * is silent: the test then records zero mutations and looks like a failure of the app
       * rather than of the harness. `document` always exists.
       */
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.target === document.documentElement) {
            readings.push(document.documentElement.className);
          }
        }
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] });
    });

    await page.goto("/login");

    const readings = await page.evaluate(
      () => (window as unknown as { __classReadings: string[] }).__classReadings,
    );

    // The very first mutation of <html>'s class must already carry `dark`. If React had
    // applied it in an effect, the class would arrive after hydration — long after the
    // document's own scripts, and after the first paint.
    expect(readings.length).toBeGreaterThan(0);
    expect(readings[0]).toContain("dark");

    /*
     * And structurally: the script that does it is inline, synchronous, and in the head.
     * `defer`, `async` or a `src` would each push execution past first paint while every
     * assertion above still passed.
     */
    const script = await page.evaluate(() => {
      const inHead = [...document.head.querySelectorAll("script")];
      const match = inHead.find((element) => element.textContent?.includes("colorScheme"));
      return match
        ? { found: true, deferred: match.defer, async: match.async, external: Boolean(match.src) }
        : { found: false, deferred: false, async: false, external: false };
    });

    expect(script).toEqual({ found: true, deferred: false, async: false, external: false });
  });

  test("keeps the browser chrome in step with an explicit preference", async ({ page }) => {
    /*
     * The layout emits a media-qualified pair of theme-color tags, which key off
     * prefers-color-scheme — the wrong signal for a user who overrode the mode. Both tags are
     * rewritten with the resolved colour so whichever the browser picks is right.
     */
    await page.addInitScript(() => localStorage.setItem("expense-tracker-color-mode", "dark"));
    await page.goto("/login");

    const contents = await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content")));

    expect(contents.length).toBeGreaterThan(0);
    expect(new Set(contents)).toEqual(new Set([RAW_COLORS.darkSurface]));
  });

  test("dark tokens resolve to the handoff's dark palette", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("expense-tracker-color-mode", "dark"));
    await page.goto("/login");

    // Reading the CSS variables directly proves the `_dark` condition fired, rather than
    // proving one element happens to be the right colour.
    const resolved = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const read = (name: string) => styles.getPropertyValue(name).trim();
      return {
        surface: read("--chakra-colors-surface"),
        content: read("--chakra-colors-content"),
        brandSolid: read("--chakra-colors-brand-solid"),
        brandContrast: read("--chakra-colors-brand-contrast"),
      };
    });

    /*
     * The browser flattens the chain to a literal, which is the stronger assertion: these are
     * the hex values in `design/ux/DESIGN.md`'s dark colour table, arrived at through the
     * `_dark` condition. Nothing in this app renders them if that condition did not fire.
     */
    expect(resolved.surface).toBe("#1E1B2C");
    expect(resolved.content).toBe("#F3F0FA");
    expect(resolved.brandSolid).toBe("#4FB9A8");
    // The one that is easy to get wrong: ink stays on teal in dark mode, because light text on
    // either teal fill measures about 2.1:1 and vanishes.
    expect(resolved.brandContrast).toBe("#1E1B29");
  });
});

test.describe("colour mode on a dark-preferring system", () => {
  test.use({ colorScheme: "dark" });

  test("honours prefers-color-scheme on a first visit", async ({ page }) => {
    // No stored preference: a first-time visitor on a dark phone should not be shown a white
    // page and asked to find a toggle.
    await page.goto("/login");

    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await bodyBackground(page)).toBe(DARK_PAGE);
  });
});
