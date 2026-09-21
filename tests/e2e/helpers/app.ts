import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Shared steps for the journey specs.
 *
 * These drive the real UI — filling the same fields a person would — rather than seeding
 * through repositories. That is the point of the E2E layer: the integration suite already
 * proves the API and the database behave, so what is left to verify is that the forms post
 * what they claim to and the results appear on screen
 * (docs/11-TESTING-STRATEGY.md section 30).
 *
 * ## Why fields are located by id rather than by label
 *
 * `getByLabel("Name", { exact: true })` does not work here. `Field` renders the required
 * marker inside the label element, so the label's text content is "Name *" while its
 * accessible name is "Name" — the asterisk is hidden from assistive technology. Exact
 * matching sees the asterisk; non-exact matching makes "Password" ambiguous with "Confirm
 * password".
 *
 * `getByRole` would use the accessible name correctly, but `input[type=password]` has no
 * ARIA role, so half the fields would need a different strategy anyway. Every field in the
 * app already carries a stable `id` that its label points at, so that is used consistently.
 * Buttons, headings and visible content are still matched by role and text, which is where
 * "test like a user" actually earns its keep.
 */

/** A password comfortably over the 10-character minimum. */
const TEST_PASSWORD = "e2e-password-1234";

/**
 * A unique email per registration.
 *
 * The database is disposable but shared across the run, and registration rejects a duplicate
 * address. Including the process id keeps addresses distinct if the suite is ever sharded.
 */
let accountCounter = 0;
export function uniqueEmail(prefix = "user"): string {
  accountCounter += 1;
  return `${prefix}-${process.pid}-${accountCounter}@example.test`;
}

export type TestAccount = { email: string; password: string; name: string };

function field(page: Page, id: string): Locator {
  return page.locator(`#${id}`);
}

/**
 * Registers a user through the sign-up form and ends on the dashboard.
 *
 * Registration signs the user in, but that is the application's choice rather than a
 * guarantee, so this falls through to an explicit sign-in if it ever changes.
 */
export async function registerAndSignIn(page: Page, name = "E2E User"): Promise<TestAccount> {
  const account: TestAccount = { email: uniqueEmail(), password: TEST_PASSWORD, name };

  await page.goto("/register");

  await field(page, "name").fill(account.name);
  await field(page, "email").fill(account.email);
  await field(page, "password").fill(account.password);
  await field(page, "confirmPassword").fill(account.password);

  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL(/\/(dashboard|login)/, { timeout: 30_000 });
  if (new URL(page.url()).pathname === "/login") {
    await signIn(page, account);
  }

  await expect(page).toHaveURL(/\/dashboard/);
  return account;
}

export async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/login");

  await field(page, "email").fill(account.email);
  await field(page, "password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function attemptSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");

  await field(page, "email").fill(email);
  await field(page, "password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
}

/**
 * Chooses an option by the text the user actually reads.
 *
 * `selectOption({ label })` needs an exact string, and these labels carry a formatted
 * balance alongside the name — "HDFC Savings · ₹50,000.00" — which is not something a test
 * should have to reproduce. So the option is found by its visible text and selected by value.
 */
export async function selectOptionByText(
  page: Page,
  selectId: string,
  optionText: string,
): Promise<void> {
  const select = field(page, selectId);
  const option = select.locator("option", { hasText: optionText }).first();

  const value = await option.getAttribute("value");
  if (!value) throw new Error(`No option matching "${optionText}" in #${selectId}`);

  await select.selectOption(value);
}

/**
 * Creates a bank account and returns its name.
 *
 * Every expense has to be paid from somewhere, so this is the prerequisite for almost every
 * journey.
 */
export async function createBankAccount(
  page: Page,
  name = "HDFC Savings",
  openingBalance = "50000",
): Promise<string> {
  await page.goto("/accounts/new");

  await field(page, "name").fill(name);
  await field(page, "type").selectOption("bank");
  await field(page, "openingBalance").fill(openingBalance);

  await page.getByRole("button", { name: "Create account" }).click();

  // The form navigates to the detail page on success, which is the signal it worked rather
  // than silently failing validation.
  await page.waitForURL(/\/accounts\/[a-f\d]{24}/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();

  return name;
}

export type ExpenseInput = {
  amount: string;
  description: string;
  accountName: string;
};

/** Fills the personal expense form and submits it. */
export async function recordPersonalExpense(page: Page, expense: ExpenseInput): Promise<void> {
  await page.goto("/transactions/new");

  await field(page, "amount").fill(expense.amount);
  await field(page, "description").fill(expense.description);
  await selectOptionByText(page, "accountId", expense.accountName);

  await page.getByRole("button", { name: "Record expense" }).click();
}

export { field as formField };
