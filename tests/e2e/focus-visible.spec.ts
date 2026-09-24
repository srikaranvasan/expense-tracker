import { expect, test } from "@playwright/test";

/**
 * The keyboard focus ring, in a real browser.
 *
 * Group 40's accessibility pass needs this and cannot get it anywhere else. `:focus-visible` is
 * a browser judgement about *how* the element was focused — it does not match on a programmatic
 * `.focus()` of a button, and jsdom has no computed shadows at all, so neither the unit nor the
 * ui project can see the ring the design relies on (section 5.3).
 *
 * The sign-in page is used because it needs no session and no seeded data, and it carries a
 * `primary` button — the tone where the ring is hardest to see, because it *replaces* an existing
 * ink shadow rather than appearing where there was none.
 *
 * Reading the shadow needs a poll, not a single read. Chakra's button recipe transitions
 * `box-shadow` over 200ms, so a value sampled in the same task that pressed Tab is a few per cent
 * along the ink→teal fade and is indistinguishable from "the rule never applied". Group 40 spent
 * real time chasing that phantom; this comment is the cheapest place to stop it happening again.
 */

/** `shadows.hardFocus` — `4px 4px 0 #7FD1C3` — as the browser reports it. */
const TEAL_RING = "rgb(127, 209, 195) 4px 4px 0px 0px";
/** `shadows.hard` — `4px 4px 0 #1E1B29`: the resting state of a primary button. */
const INK_SHADOW = "rgb(30, 27, 41) 4px 4px 0px 0px";
/** `shadows.hardFocus` under `_dark`, which resolves to `darkTeal` — `#4FB9A8`. */
const DARK_TEAL_RING = "rgb(79, 185, 168) 4px 4px 0px 0px";
test.describe("keyboard focus ring", () => {
  test.use({ colorScheme: "light" });

  test("a keyboard-focused primary button swaps its ink shadow for the teal ring", async ({
    page,
  }) => {
    await page.goto("/login");
    const submit = page.locator('button[type="submit"]');

    // At rest: the ink offset shadow that marks the page's primary action.
    await expect.poll(() => submit.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(INK_SHADOW);

    // Tab, rather than `.focus()`: only a real key press makes the browser consider focus visible.
    await page.keyboard.press("Tab");
    for (let i = 0; i < 20; i += 1) {
      if (await submit.evaluate((e) => e === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(submit).toBeFocused();

    await expect.poll(() => submit.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(TEAL_RING);
  });

  test("a mouse click leaves the resting shadow alone", async ({ page }) => {
    /*
     * The other half of the contract. `:focus-visible` exists so a pointer user does not get a
     * ring they did not ask for; if this ever starts matching on click, the design's focus device
     * stops meaning "you are here with the keyboard".
     *
     * The email field is clicked rather than the submit button, because clicking submit navigates.
     */
    await page.goto("/login");
    const email = page.locator("#email");

    await email.click();
    await expect(email).toBeFocused();
    // Inputs are the exception: the browser considers focus visible on a text field however it
    // was focused, since the caret is there either way. Asserting the button instead.
    const submit = page.locator('button[type="submit"]');
    await expect.poll(() => submit.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(INK_SHADOW);
  });
});

test.describe("keyboard focus ring in dark mode", () => {
  test("the ring stays teal against the dark paper", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("expense-tracker-color-mode", "dark"));
    await page.goto("/login");

    const submit = page.locator('button[type="submit"]');
    await page.keyboard.press("Tab");
    for (let i = 0; i < 20; i += 1) {
      if (await submit.evaluate((e) => e === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(submit).toBeFocused();

    await expect
      .poll(() => submit.evaluate((e) => getComputedStyle(e).boxShadow))
      .toBe(DARK_TEAL_RING);
  });
});
