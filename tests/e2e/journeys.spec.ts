import { expect, test } from "@playwright/test";
import {
  attemptSignIn,
  createBankAccount,
  formField,
  recordPersonalExpense,
  registerAndSignIn,
  selectOptionByText,
  signIn,
  signOut,
} from "./helpers/app";

/**
 * Smoke journeys through the real UI.
 *
 * Deliberately a small suite. The integration tests already prove every financial rule from
 * the route handler down to MongoDB — several hundred of them — so repeating those assertions
 * here would be slow and would fail twice for one cause. What only a browser can prove is the
 * layer above: that the forms post the fields they claim to, that a server action's result
 * reaches the screen, and that navigation between them works.
 *
 * Run with `npm run test:e2e`, which boots a disposable in-memory replica set first. Running
 * `npx playwright test` directly points these at whatever `.env.local` names, which is the
 * developer's real database.
 */

test.describe("authentication", () => {
  test("a new user can register, sign out, and sign back in", async ({ page }) => {
    const account = await registerAndSignIn(page);

    /*
     * Registration lands on a working dashboard, not a blank shell.
     *
     * Pinned to the `h1`, and to the exact name. A brand-new account sees an empty state as well as
     * the page header, and group 40 made that empty state's title a real heading — "Your dashboard is
     * waiting on some data" — so `/dashboard/i` now matches two headings. Both are correct; the test
     * has to say which one it means.
     */
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await signOut(page);

    // The session is genuinely gone: the dashboard must bounce back to sign-in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, account);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a wrong password is refused without confirming the address exists", async ({ page }) => {
    const account = await registerAndSignIn(page);
    await signOut(page);

    await attemptSignIn(page, account.email, "definitely-not-the-password");

    // Still on the sign-in page, with an error that does not distinguish a wrong password
    // from an unknown account (docs/12-SECURITY-AND-ERROR-HANDLING.md section 7).
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    const message = (await page.getByRole("alert").textContent()) ?? "";
    expect(message).not.toMatch(/password is incorrect|no such user|not registered/i);
  });

  test("an unknown address is refused the same way", async ({ page }) => {
    await attemptSignIn(page, "nobody-at-all@example.test", "some-password-1234");

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("personal expense", () => {
  test("can be recorded and appears in the history with the balance reduced", async ({ page }) => {
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page, "HDFC Savings", "50000");

    await recordPersonalExpense(page, {
      amount: "450.50",
      description: "Groceries at the market",
      accountName,
    });

    /*
     * Waits for the detail page specifically.
     *
     * An earlier version waited for `/transactions(\/|$)/`, which `/transactions/new` also
     * matches — so it passed instantly while the form was still on screen with a validation
     * error, and the failure surfaced later as a confusing "row not found".
     */
    await page.waitForURL(/\/transactions\/[a-f\d]{24}$/, { timeout: 30_000 });

    await page.goto("/transactions");
    await expect(page.getByText("Groceries at the market")).toBeVisible();

    /*
     * The balance is the assertion that matters. A UI that records the expense but does not
     * reduce the account is the failure worth catching, and it is invisible to a test that
     * only checks the row appeared.
     *
     * 50000 - 450.50 = 49549.50. Matched loosely because the rendered string carries a
     * currency symbol and digit grouping, and `.first()` because the figure legitimately
     * appears more than once — in the summary and against the account itself.
     */
    await page.goto("/accounts");
    await expect(page.getByText(/49,?549\.50/).first()).toBeVisible();
  });

  test("a zero amount is reported on the form, not as a crash", async ({ page }) => {
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page);

    await page.goto("/transactions/new");
    await formField(page, "amount").fill("0");
    await formField(page, "description").fill("Zero amount");
    await selectOptionByText(page, "accountId", accountName);
    await page.getByRole("button", { name: "Record expense" }).click();

    /*
     * A validation failure belongs on the form, not in an error boundary: a boundary would
     * replace the screen and lose everything typed, which is why actions return `ActionState`
     * rather than throwing (docs/updates/GROUP-18-ERROR-HANDLING.md).
     */
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toHaveCount(0);
    await expect(page).toHaveURL(/\/transactions\/new/);

    // The rejection is announced on the field itself, not only as a colour
    // (docs/06-CODING-PRACTICES.md section 40).
    await expect(formField(page, "amount")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/greater than zero/i).first()).toBeVisible();

    /*
     * Note what is *not* asserted: that the typed amount survived. It does not — the inputs
     * are uncontrolled with no `defaultValue` on a new expense, so a rejected submission
     * clears them. Recorded as a known gap in docs/updates/GROUP-19-TESTING.md rather than
     * pinned here, because the current behaviour is not the behaviour worth locking in.
     */
  });
});

test.describe("data isolation", () => {
  test("a second user sees none of the first user's data", async ({ page }) => {
    await registerAndSignIn(page, "First User");
    await createBankAccount(page, "First User Bank", "10000");
    await signOut(page);

    // Same browser, same cookie jar, different account. The integration suite proves the
    // queries are scoped; this proves the session swap actually takes effect in the UI.
    await registerAndSignIn(page, "Second User");

    await page.goto("/accounts");
    await expect(page.getByText("First User Bank")).toHaveCount(0);
  });
});

test.describe("not found", () => {
  test("an unknown record shows the in-app not-found page", async ({ page }) => {
    await registerAndSignIn(page);

    // A well-formed id that belongs to nothing. Only reachable with a session, which is why
    // group 18 could not cover this.
    await page.goto("/transactions/0123456789abcdef01234567");

    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
    // The shell survives, so there is a way onward.
    await expect(page.getByRole("link", { name: /back to transactions/i })).toBeVisible();
  });
});
