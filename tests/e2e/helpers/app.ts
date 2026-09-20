import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Shared steps for the journey specs.
 *
 * These drive the real UI — filling the same fields a person would — rather than seeding
 * through repositories. That is the whole point of the E2E layer: the integration suite
 * already proves the API and the database behave, so what is left to verify is that the
 * forms submit what they claim to and the results appear on screen
 * (docs/11-TESTING-STRATEGY.md section 30).
 */

/** A password comfortably over the 10-character minimum. */
const TEST_PASSWORD = "e2e-password-1234";

/**
 * A unique email per test.
 *
 * The database is disposable but shared across the run, and registration rejects a
 * duplicate address. Deriving from the worker index plus a counter keeps the addresses
 * stable enough to read in a failure message.
 */
let accountCounter = 0;
export function uniqueEmail(prefix = "user"): string {
  accountCounter += 1;
  return `${prefix}-${process.pid}-${accountCounter}@example.test`;
}

export type TestAccount = { email: string; password: string; name: string };

/**
 * Registers a user through the sign-up form and ends on the dashboard.
 *
 * Registration signs the user in, but that is the application's choice rather than a
 * guarantee, so this falls through to an explicit sign-in if it ever changes.
 */
export async function registerAndSignIn(page: Page, name = "E2E User"): Promise<TestAccount> {
  const account: TestAccount = { email: uniqueEmail(), password: TEST_PASSWORD, name };

  await page.goto("/register");

  await page.getByLabel("Name", { exact: true }).fill(account.name);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByLabel("Confirm password").fill(account.password);

  await page.getByRole("button", { name: "Create account" }).click();

  // Either outcome is acceptable; both must end on the dashboard.
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 30_000 });
  if (new URL(page.url()).pathname === "/login") {
    await signIn(page, account);
  }

  await expect(page).toHaveURL(/\/dashboard/);
  return account;
}

export async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
}

/**
 * Creates a bank account and returns its name.
 *
 * Every expense needs one — an expense has to be paid from somewhere — so this is the
 * prerequisite step for almost every journey.
 */
export async function createBankAccount(
  page: Page,
  name = "HDFC Savings",
  openingBalance = "50000",
): Promise<string> {
  await page.goto("/accounts/new");

  await page.getByLabel("Account name").fill(name);
  await page.getByLabel("Type", { exact: true }).selectOption("bank");

  // The label carries the currency, so it is matched loosely.
  await page.getByLabel(/^Opening balance/).fill(openingBalance);

  await page.getByRole("button", { name: "Create account" }).click();

  // The form navigates to the detail page on success, which is the signal it worked.
  await page.waitForURL(/\/accounts\/[a-f\d]{24}/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();

  return name;
}

/**
 * Chooses an option by the text the user actually reads.
 *
 * `selectOption({ label })` needs an exact string, and these labels carry a formatted
 * balance alongside the name — "HDFC Savings · ₹50,000.00" — which is not something a test
 * should have to reproduce. So the option is found by its visible text and selected by its
 * value.
 */
export async function selectOptionByText(
  page: Page,
  fieldLabel: string,
  optionText: string,
): Promise<void> {
  const select = page.getByLabel(fieldLabel);
  const option = select.locator("option", { hasText: optionText }).first();

  const value = await option.getAttribute("value");
  if (!value) throw new Error(`No option matching "${optionText}" in "${fieldLabel}"`);

  await select.selectOption(value);
}

export type ExpenseInput = {
  amount: string;
  description: string;
  accountName: string;
};

/** Records a personal expense through the form. */
export async function recordPersonalExpense(page: Page, expense: ExpenseInput): Promise<void> {
  await page.goto("/transactions/new");

  await page.getByLabel(/^Amount/).fill(expense.amount);
  await page.getByLabel("What was it for?").fill(expense.description);
  await selectOptionByText(page, "Paid from", expense.accountName);

  await page.getByRole("button", { name: "Record expense" }).click();
}
