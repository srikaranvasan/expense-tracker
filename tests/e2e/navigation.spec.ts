import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createBankAccount,
  formField,
  recordPersonalExpense,
  registerAndSignIn,
  selectOptionByText,
} from "./helpers/app";

/**
 * On-screen navigation: the back link on every child page, and where Cancel goes.
 *
 * ## Why this suite has to exist, and why it has to use a browser
 *
 * Every screen this covers **already rendered and already passed its tests** before groups 42-48.
 * A missing back link is invisible to a type checker, to a unit test and to a screenshot review.
 *
 * More importantly, the defect being fixed only appears on a **cold URL**. Cancel used to call
 * `router.back()`, which is correct when the user clicked in from a list — so a test that navigates
 * by clicking would pass whether the fix is present or not. These tests call `page.goto()` and then
 * cancel, with no history to walk, which is the case that was broken
 * (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 4.3).
 *
 * That is also why this is a Playwright spec rather than a jsdom test: `goto` with no prior history
 * is not something jsdom can model.
 *
 * Run with `npm run test:e2e`.
 */

/** The back link's accessible name is always "Back to <destination>" (group 42 section 3.4). */
function backLink(page: Page, destination: string) {
  return page.getByRole("link", { name: `Back to ${destination}`, exact: true });
}

/**
 * Opens a URL with no usable history behind it, then returns the page.
 *
 * `about:blank` first, so the only entry preceding the target is a blank page — the situation a
 * shared link, a bookmark or a fresh tab produces, and the one `router.back()` could not handle.
 */
async function openCold(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

test.describe("back links on detail pages", () => {
  test("an account detail page returns to the accounts list", async ({ page }) => {
    await registerAndSignIn(page);
    await createBankAccount(page, "HDFC Savings", "50000");

    const accountUrl = page.url();
    await openCold(page, accountUrl);

    await expect(backLink(page, "Accounts")).toBeVisible();
    await backLink(page, "Accounts").click();
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test("an expense detail page returns to Activity, not to Transactions", async ({ page }) => {
    /*
     * The label is the point. `/transactions` is called "Activity" in the tab bar, and a back link
     * saying "Transactions" would give one screen two names. `PARENTS` derives the label from
     * `NAV_ITEMS` so this cannot drift.
     */
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page);

    await recordPersonalExpense(page, {
      amount: "450.50",
      description: "Groceries at the market",
      accountName,
    });
    await page.waitForURL(/\/transactions\/[a-f\d]{24}$/, { timeout: 30_000 });

    await openCold(page, page.url());

    await expect(backLink(page, "Activity")).toBeVisible();
    // And specifically not the path's own name, which is the drift this guards against.
    await expect(backLink(page, "Transactions")).toHaveCount(0);

    await backLink(page, "Activity").click();
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("a person detail page returns to the people list", async ({ page }) => {
    await registerAndSignIn(page);

    await page.goto("/people/new");
    await formField(page, "name").fill("Priya Menon");
    await page.getByRole("button", { name: "Add person" }).click();
    await page.waitForURL(/\/people\/[a-f\d]{24}$/, { timeout: 30_000 });

    await openCold(page, page.url());

    await expect(backLink(page, "People")).toBeVisible();
    await backLink(page, "People").click();
    await expect(page).toHaveURL(/\/people$/);
  });
});

test.describe("Cancel on a cold URL", () => {
  /*
   * The eight forms, opened directly. Before group 46 every one of these called `router.back()`, so
   * on a cold URL Cancel either did nothing or left the application entirely.
   */

  test("a create form cancels to its section list", async ({ page }) => {
    await registerAndSignIn(page);

    await openCold(page, "/accounts/new");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/accounts$/);

    await openCold(page, "/people/new");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/people$/);
  });

  test("the expense form cancels to Activity even when opened directly", async ({ page }) => {
    await registerAndSignIn(page);
    await createBankAccount(page);

    await openCold(page, "/transactions/new");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("an edit form cancels to the record, not to the list", async ({ page }) => {
    /*
     * The hierarchical answer: the change would have been visible on the record, so that is where
     * abandoning it returns to. Group 42 section 3.6 accepted the trade — a filtered list URL is not
     * restored — deliberately.
     */
    await registerAndSignIn(page);
    await createBankAccount(page, "HDFC Savings", "50000");

    const accountUrl = new URL(page.url()).pathname;
    await openCold(page, `${accountUrl}/edit`);

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`${accountUrl}$`));
  });
});

test.describe("prerequisite guards", () => {
  test("the expense form offers a way to create the account it needs", async ({ page }) => {
    /*
     * The most common first experience in the app: a brand-new user taps "Add expense" before
     * creating anything. The guard told them to create an account and did not say where — and because
     * the guard replaces the form, there was no Cancel on the page either (audit 5.7).
     */
    await registerAndSignIn(page);

    await openCold(page, "/transactions/new");

    await expect(page.getByRole("heading", { name: "Add expense" })).toBeVisible();

    const addAccount = page.getByRole("link", { name: "Add an account" });
    await expect(addAccount).toBeVisible();
    await addAccount.click();
    await expect(page).toHaveURL(/\/accounts\/new$/);
  });

  test("the split form offers a way to add the person it needs", async ({ page }) => {
    await registerAndSignIn(page);
    await createBankAccount(page);

    await openCold(page, "/transactions/new/shared");

    const addPerson = page.getByRole("link", { name: "Add a person" });
    await expect(addPerson).toBeVisible();
    await addPerson.click();
    await expect(page).toHaveURL(/\/people\/new$/);
  });

  test("a guard screen still has a back link, since it has no Cancel", async ({ page }) => {
    await registerAndSignIn(page);

    await openCold(page, "/transactions/new/transfer");

    // No form, therefore no FormActions, therefore no Cancel. The back link is the only way out.
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(backLink(page, "Activity")).toBeVisible();
  });
});

test.describe("the settlement dead end", () => {
  test("a settlement detail page can reach its own list", async ({ page }) => {
    /*
     * Audit 6.1, the worst reachability defect in the app. `/settlements` is not in the tab bar, so
     * before group 45 a settlement detail page could not reach its list at all — the only options
     * were nav destinations in other sections.
     */
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page, "HDFC Savings", "50000");

    // A shared expense, so there is something to settle.
    await page.goto("/people/new");
    await formField(page, "name").fill("Arun Kumar");
    await page.getByRole("button", { name: "Add person" }).click();
    await page.waitForURL(/\/people\/[a-f\d]{24}$/, { timeout: 30_000 });
    const personUrl = new URL(page.url()).pathname;

    await page.goto("/transactions/new/shared");
    await formField(page, "amount").fill("1000");
    await formField(page, "description").fill("Team dinner");
    await selectOptionByText(page, "accountId", accountName);

    /*
     * Adding the participant is required, not optional decoration: the form refuses to submit with
     * only the user on it — "a shared expense needs at least one other person. Record it as a personal
     * expense instead." Selecting from "Add someone" appends them and re-spreads the equal split.
     */
    await selectOptionByText(page, "addParticipant", "Arun Kumar");
    await expect(page.getByLabel("Arun Kumar")).toBeVisible();

    await page.getByRole("button", { name: "Record shared expense" }).click();
    await page.waitForURL(/\/transactions\/[a-f\d]{24}$/, { timeout: 30_000 });

    // Settle it, which lands on the settlement.
    await page.goto(`${personUrl}/settle`);
    await page.getByRole("button", { name: "Record settlement" }).click();
    await page.waitForURL(/\/(settlements\/[a-f\d]{24}|people\/[a-f\d]{24})$/, { timeout: 30_000 });

    await page.goto("/settlements");
    await page
      .getByRole("link", { name: /Arun Kumar/ })
      .first()
      .click();
    await page.waitForURL(/\/settlements\/[a-f\d]{24}$/, { timeout: 30_000 });

    await openCold(page, page.url());

    await expect(backLink(page, "Settlements")).toBeVisible();
    await backLink(page, "Settlements").click();
    await expect(page).toHaveURL(/\/settlements$/);
  });

  test("the people list can reach the settlements list", async ({ page }) => {
    /*
     * The other half of the `/settlements` fix. It stays out of the tab bar by decision (group 42
     * section 3.2) — a sixth tab would have crushed every label at 402px — so it is reached from a tab
     * bar destination instead, which makes it two taps from anywhere.
     */
    await registerAndSignIn(page);

    await openCold(page, "/people");

    const link = page.getByRole("link", { name: /Settlement history/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/settlements$/);
  });
});

test.describe("the two layout fixes this series risked", () => {
  /*
   * Group 44 restructured `PageHeader` and group 46 changed what every `onCancel` does. Both sit on
   * top of measured bug fixes from the design series
   * (`docs/design-tasks/01-DESIGN-SYSTEM.md` section 9.2), and neither fix has a unit test that can
   * prove it — jsdom evaluates no media queries and has no layout engine.
   *
   * So the numbers are taken here, in a real browser, at the width the bugs appeared at.
   */

  test("the mobile page title still renders on one line at 393px", async ({ page }) => {
    /*
     * The crushed-title bug: at 402px a title sharing a row with action buttons was left ~150px and
     * wrapped to one word per line. The back link now sits above that title, so the risk was that it
     * either joined the row or pushed the title into a narrower box.
     *
     * Measured by line count, not by eye: a `<h1>`'s height divided by its line height.
     */
    await page.setViewportSize({ width: 393, height: 852 });
    await registerAndSignIn(page);
    await createBankAccount(page, "HDFC Savings", "50000");

    // "Add expense" plus a three-button FormSwitcher — the worst case for this header.
    await page.goto("/transactions/new");

    const heading = page.getByRole("heading", { level: 1, name: "Add expense" });
    await expect(heading).toBeVisible();

    const lines = await heading.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      const lineHeight = parseFloat(styles.lineHeight);
      return Math.round(element.getBoundingClientRect().height / lineHeight);
    });
    expect(lines).toBe(1);

    // And the title row is still stacked, which is the half of the fix that lives on that row.
    const titleRow = await heading.evaluate(
      (element) => window.getComputedStyle(element.parentElement!.parentElement!).flexDirection,
    );
    expect(titleRow).toBe("column");

    // The back link is above the row, not inside it — the group 44 baseline decision.
    await expect(backLink(page, "Activity")).toBeVisible();
  });

  test("Cancel stays inside its card at 393px and at 1440px", async ({ page }) => {
    /*
     * The clipped-Cancel bug: a full-width submit with Cancel beside it overflowed the row, so Cancel
     * was cut off on every create and edit form. `FormActions` was not modified by this series — only
     * `onCancel`'s body — but "we did not touch it" is a weaker claim than a measurement.
     */
    await registerAndSignIn(page);
    await createBankAccount(page);

    for (const width of [393, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/transactions/new");

      const cancel = page.getByRole("button", { name: "Cancel" });
      await expect(cancel).toBeVisible();

      const box = await cancel.boundingBox();
      const card = await cancel.evaluate((element) => {
        const form = element.closest("form")!;
        const { left, right } = form.getBoundingClientRect();
        return { left, right };
      });

      expect(box).not.toBeNull();
      // Both edges inside the form's own box: nothing clipped, nothing overflowing.
      expect(box!.x).toBeGreaterThanOrEqual(card.left - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(card.right + 1);
      // And it kept a real width rather than being squeezed to its ellipsis.
      expect(box!.width).toBeGreaterThan(60);
    }
  });
});
