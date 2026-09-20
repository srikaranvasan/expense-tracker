import { expect, test } from "@playwright/test";
import {
  createBankAccount,
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
 * the route handler down to MongoDB — 400-odd of them — so duplicating those assertions
 * here would be slow and would fail twice for one cause. What only a browser can prove is
 * the layer above: that the forms post the fields they claim to, that a server action's
 * result reaches the screen, and that navigation between them works.
 *
 * Run with `npm run test:e2e`, which boots a disposable in-memory replica set first. Running
 * `npx playwright test` directly points these at whatever `.env.local` names, which is the
 * developer's real database.
 */

test.describe("authentication", () => {
  test("a new user can register, sign out, and sign back in", async ({ page }) => {
    const account = await registerAndSignIn(page);

    // Registration lands on a working dashboard, not a blank shell.
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    await signOut(page);
    // The session is genuinely gone: the dashboard must bounce back to sign-in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, account);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a wrong password is refused without saying which field was wrong", async ({ page }) => {
    const account = await registerAndSignIn(page);
    await signOut(page);

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Still on the sign-in page, with an error that does not confirm the email exists
    // (docs/12-SECURITY-AND-ERROR-HANDLING.md section 7).
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert")).not.toContainText(/password is incorrect/i);
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

    // The form navigates on success. Waiting for the URL rather than the text avoids
    // asserting against a form that silently failed validation.
    await page.waitForURL(/\/transactions(\/|$)/, { timeout: 30_000 });

    await page.goto("/transactions");
    await expect(page.getByText("Groceries at the market")).toBeVisible();

    /*
     * The balance is the assertion that matters. A UI that records the expense but does not
     * reduce the account is the failure mode worth catching, and it is invisible to a test
     * that only checks the row appeared.
     *
     * 50000 - 450.50 = 49549.50. Matched loosely because the rendered string carries a
     * currency symbol and digit grouping.
     */
    await page.goto("/accounts");
    await expect(page.getByText(/49,?549\.50/)).toBeVisible();
  });

  test("an invalid amount is reported on the field, not as a crash", async ({ page }) => {
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page);

    await page.goto("/transactions/new");
    await page.getByLabel(/^Amount/).fill("0");
    await page.getByLabel("What was it for?").fill("Zero amount");
    await selectOptionByText(page, "Paid from", accountName);
    await page.getByRole("button", { name: "Record expense" }).click();

    // A validation failure belongs on the form. If it tripped the error boundary instead, the
    // user would lose everything they typed (docs/updates/GROUP-18-ERROR-HANDLING.md).
    await expect(page.getByRole("heading", { name: /something went wrong/i })).not.toBeVisible();
    await expect(page).toHaveURL(/\/transactions\/new/);
    await expect(page.getByLabel(/^Amount/)).toHaveValue("0");
  });
});

test.describe("data isolation", () => {
  test("a second user sees none of the first user's data", async ({ page }) => {
    await registerAndSignIn(page, "First User");
    await createBankAccount(page, "First User Bank", "10000");
    await signOut(page);

    // Same browser, same cookies jar, different account.
    await registerAndSignIn(page, "Second User");

    await page.goto("/accounts");
    await expect(page.getByText("First User Bank")).not.toBeVisible();
  });
});
