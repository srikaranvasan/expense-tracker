/**
 * Captures a full set of UI screenshots for design handoff.
 *
 * Why this is a script rather than a Playwright spec:
 *
 * The output is a deliverable, not an assertion. A spec would give us retries, sharding and
 * a reporter we do not want, and — more importantly — the capture order matters. Some shots
 * must be taken *before* the action that changes the data (the settle-up form only exists
 * while there is something to settle), and both viewports must see the same records. A test
 * runner that is free to reorder or parallelise cannot guarantee that.
 *
 * It follows `scripts/run-e2e.ts` for infrastructure: a disposable in-memory MongoDB replica
 * set (needed because every financial write goes through `withTransaction()`) and a
 * production build served by `next start`. The developer's own cluster in `.env.local` is
 * never touched, and nothing here can write to it.
 *
 * Two datasets are captured so the design team sees both ends of the range:
 *
 *   - a freshly registered user, which is every empty state and every "add X first" guard
 *   - a seeded user, which is every list, detail and summary with realistic INR amounts
 *
 * Usage:
 *   npm run screenshots                 build, serve, capture
 *   npm run screenshots -- --skip-build reuse an existing .next (much faster on re-runs)
 *   npm run screenshots -- --headed     watch it happen
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// --------------------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------------------

/** Distinct from dev (4000), e2e (4300) and the Playwright config default (4200). */
const PORT = Number(process.env.SCREENSHOT_PORT ?? 4400);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_NAME = "expense_tracker_screenshots";

const OUTPUT_ROOT = path.join(process.cwd(), "design", "screenshots");

const args = process.argv.slice(2);
const SKIP_BUILD = args.includes("--skip-build");
const HEADED = args.includes("--headed");

const PASSWORD = "screenshot-password-1234";

type Profile = {
  /** Output sub-folder. */
  key: string;
  /** Shown in the README. */
  label: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
  /**
   * Which colour mode to photograph. Added in group 41, because dark mode shipped in group 24 and
   * the handoff draws only two dark artboards — the designer has seen almost none of it.
   */
  colorScheme: "light" | "dark";
  /**
   * Restricts this profile to a subset of `EXPECTED_SHOTS`.
   *
   * The dark profiles use it. Photographing all 53 screens twice more would produce 212 images and
   * ask the designer to review a hundred of them for a palette flip; the subset below is chosen to
   * exercise **every surface, fill, badge and state token at least once**, which is what a dark-mode
   * review actually needs.
   */
  only?: readonly string[];
};

/**
 * iPhone 16 Pro: 402 x 874 CSS pixels at a device pixel ratio of 3.
 *
 * Declared explicitly rather than taken from Playwright's `devices` map, which pins a
 * `defaultBrowserType` of webkit that `newContext()` does not accept, and which may not
 * carry this model in every version.
 */
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/**
 * The dark-mode subset, chosen by coverage rather than by importance.
 *
 * Between them these eighteen screens render every semantic colour the theme defines: all five
 * swatch fills, both amount directions, every `StatusBadge` kind that exists in seeded data, the
 * accent tint, the sunken inset, an `Alert`, a `Stamp`, an `EmptyState`, an error field, the three
 * button tones that appear outside a delete confirmation, and the offset shadows on both a card and
 * a button.
 */
const DARK_SHOTS = [
  "01-login",
  "05-dashboard-empty",
  "19-dashboard",
  "20-accounts",
  "21-account-detail-bank",
  "22-account-detail-credit-card",
  "24-people",
  "25-person-detail-owes-you",
  "29-categories",
  "30-categories-add-form",
  "32-activity",
  "34-expense-new",
  "35-expense-new-validation-errors",
  "39-split-new-equal-split",
  "41-expense-detail-shared",
  "46-settle-up",
  "47-settle-up-unbalanced",
  "50-not-found-page",
  "54-quick-add-expanded",
] as const;

const PROFILES: readonly Profile[] = [
  {
    key: "desktop",
    label: "Desktop — 1440 x 900 — light",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    colorScheme: "light",
  },
  {
    key: "mobile",
    label: "iPhone 16 Pro — 402 x 874 @3x — light",
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
    colorScheme: "light",
  },
  {
    key: "desktop-dark",
    label: "Desktop — 1440 x 900 — dark",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    colorScheme: "dark",
    only: DARK_SHOTS,
  },
  {
    key: "mobile-dark",
    label: "iPhone 16 Pro — 402 x 874 @3x — dark",
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
    colorScheme: "dark",
    only: DARK_SHOTS,
  },
];

/**
 * Every screenshot this script is expected to produce, in reading order.
 *
 * Kept as a single list so the numbering is decided in one place and so the run can verify
 * at the end that nothing silently failed to capture. `shot()` rejects a name that is not
 * here, which turns a typo into an immediate error rather than a stray file.
 */
const EXPECTED_SHOTS = [
  // Getting in
  "01-login",
  "02-login-invalid-credentials",
  "03-register",
  "04-register-validation-errors",

  // First run — a brand-new account with nothing in it
  "05-dashboard-empty",
  "06-accounts-empty",
  "07-account-new",
  "08-account-new-credit-card",
  "09-account-new-validation-errors",
  "10-people-empty",
  "11-person-new",
  "12-categories-defaults",
  "13-activity-empty",
  "14-expense-new-needs-account",
  "15-split-new-needs-person",
  "16-transfer-new-needs-accounts",
  "17-card-payment-new-needs-accounts",
  "18-settlements-empty",

  // Everyday use — a seeded account
  "19-dashboard",
  "20-accounts",
  "21-account-detail-bank",
  "22-account-detail-credit-card",
  "23-account-edit",
  "24-people",
  "25-person-detail-owes-you",
  "26-person-detail-you-owe",
  "27-person-detail-settled",
  "28-person-edit",
  "29-categories",
  "30-categories-add-form",
  "31-categories-edit-row",
  "32-activity",
  "33-activity-filtered",
  "34-expense-new",
  "35-expense-new-validation-errors",
  "36-expense-detail-personal",
  "37-expense-edit",
  "38-split-new",
  "39-split-new-equal-split",
  "40-split-new-validation-errors",
  "41-expense-detail-shared",
  "42-transfer-new",
  "43-transfer-detail",
  "44-card-payment-new",
  "45-card-payment-detail",
  "46-settle-up",
  "47-settle-up-unbalanced",
  "48-settlements",
  "49-settlement-detail",

  // System states
  "50-not-found-page",
  "51-not-found-record",
  "52-offline",
  "53-install-prompt",
  /**
   * Added in group 41. `Mobile-QuickAdd-Expanded.html` is one of the eleven artboards and nothing in
   * this set showed the state it draws — the reviewer had a design with nothing to compare it to.
   *
   * Captured viewport-only, because the layer sits over a fixed scrim.
   */
  "54-quick-add-expanded",
  /**
   * Added in group 48 — the navigation series.
   *
   * The "Cannot edit" guard on a settled expense, and the only screen in the app that had no capture
   * at all. It was also the worst screen in the app for navigation: a title, a warning paragraph, and
   * nothing else — no Cancel, because the form never renders, and no link to either record the prose
   * names (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 6.3).
   *
   * A screen with no screenshot is a screen nobody reviews, which is how it stayed that way through
   * twenty-one design groups.
   */
  "55-expense-edit-settled",
] as const;

type ShotName = (typeof EXPECTED_SHOTS)[number];

/**
 * Shots only one profile can produce.
 *
 * The install invitation is driven by the platform: on iOS there is no `beforeinstallprompt`
 * event, so the component falls back to describing Safari's Share menu and is always
 * offered. Headless Chromium at a desktop size never fires the event either, so there is
 * nothing to photograph on that side.
 */
const PROFILE_ONLY: Record<string, readonly ShotName[]> = {
  mobile: ["53-install-prompt", "54-quick-add-expanded"],
  // Listing the quick-add under both mobile keys is what keeps it in each of them: `expectedFor`
  // excludes a name from a profile only if some *other* profile claims it exclusively.
  "mobile-dark": ["54-quick-add-expanded"],
};

/**
 * Which shots a profile is expected to produce.
 *
 * Two filters. A shot named in `PROFILE_ONLY` belongs to the profiles that claim it and to no
 * others — a shot may be claimed by more than one, which is how the quick-add appears in both mobile
 * profiles. A profile with an `only` list is then narrowed to it.
 */
function expectedFor(profileKey: string): readonly ShotName[] {
  const owners = new Map<string, Set<string>>();
  for (const [key, names] of Object.entries(PROFILE_ONLY)) {
    for (const name of names) {
      const set = owners.get(name) ?? new Set<string>();
      set.add(key);
      owners.set(name, set);
    }
  }

  const only = PROFILES.find((profile) => profile.key === profileKey)?.only;
  const subset = only ? new Set<string>(only) : null;

  return EXPECTED_SHOTS.filter((name) => {
    const claimedBy = owners.get(name);
    if (claimedBy && !claimedBy.has(profileKey)) return false;
    return subset === null || subset.has(name);
  });
}

/** Precomputed, because `shot()` consults it on every call. */
const ALLOWED_FOR = new Map<string, Set<string>>(
  PROFILES.map((profile) => [profile.key, new Set<string>(expectedFor(profile.key))]),
);

const expectedSet = new Set<string>(EXPECTED_SHOTS);
const captured = new Map<string, Set<string>>(PROFILES.map((p) => [p.key, new Set<string>()]));
const problems: string[] = [];

// --------------------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------------------

function log(message: string): void {
  console.log(message);
}

function note(message: string): void {
  problems.push(message);
  console.warn(`  ! ${message}`);
}

/** A clientId the API will accept: 32 hex characters. */
function clientId(): string {
  return randomUUID().replace(/-/g, "");
}

let emailCounter = 0;
function uniqueEmail(prefix: string): string {
  emailCounter += 1;
  return `${prefix}-${process.pid}-${emailCounter}@example.test`;
}

/**
 * An ISO timestamp `days` ago, clamped to the first of the current month.
 *
 * The dashboard's spending total covers the current month only, so a seed date that slipped
 * into the previous one would leave that figure looking wrong in the screenshot.
 */
function daysAgo(days: number): string {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 12, 0, 0),
  );
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
  return (target < monthStart ? monthStart : target).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------------------------------------------------------------------------------
// Infrastructure: database, build, server
// --------------------------------------------------------------------------------------

function run(command: string, cmdArgs: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    // `shell: true` is needed for `npm`/`npx` to resolve on Windows.
    const child = spawn(command, cmdArgs, { stdio: "inherit", env, shell: true });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${String(code)}`)),
    );
    child.on("error", reject);
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      // Any HTTP answer means Next is listening; a redirect is still an answer.
      if (response.status > 0) return;
    } catch {
      // Not up yet.
    }
    await sleep(500);
  }

  throw new Error(`Server did not become ready at ${url}`);
}

// --------------------------------------------------------------------------------------
// Page helpers
// --------------------------------------------------------------------------------------

function field(page: Page, id: string) {
  return page.locator(`#${id}`);
}

/**
 * Navigates and waits for the page to stop moving.
 *
 * `networkidle` alone is not enough: Chakra mounts with a brief layout pass and the sync
 * status bar settles a moment later, so a short pause afterwards keeps the images stable
 * between runs.
 */
async function visit(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  await settle(page);
}

async function settle(page: Page): Promise<void> {
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => undefined /* a page with an open connection never idles; carry on */);
  await sleep(450);
}

type ShotOptions = {
  /**
   * Capture the viewport rather than the whole page, leaving fixed elements where they really sit.
   *
   * For an overlay state — the quick-add layer over its scrim — a full-page capture is actively
   * misleading: the scrim is `position: fixed` and covers one viewport, so a 2,000px image shows a
   * dimmed top and an undimmed remainder, which is not a state the app can be in.
   */
  viewportOnly?: boolean;
};

async function shot(
  page: Page,
  profile: Profile,
  name: ShotName,
  options: ShotOptions = {},
): Promise<void> {
  if (!expectedSet.has(name)) {
    throw new Error(`"${name}" is not listed in EXPECTED_SHOTS`);
  }

  /*
   * A profile that is not expected to produce this shot walks the same passes and does not fire.
   *
   * Skipping the navigation instead would mean four capture functions each growing a set of
   * conditionals, and the dark subset would then be defined in five places. One filter here, at the
   * shutter, keeps it in one.
   */
  if (!ALLOWED_FOR.get(profile.key)?.has(name)) return;

  const file = path.join(OUTPUT_ROOT, profile.key, `${name}.png`);

  try {
    if (!options.viewportOnly && !(await unpinFixedChrome(page))) {
      note(`${profile.key}/${name}: fixed chrome is still pinned`);
    }
    await page.screenshot({
      path: file,
      fullPage: !options.viewportOnly,
      animations: "disabled",
      scale: "device",
    });
    captured.get(profile.key)?.add(name);
  } catch (error) {
    note(`${profile.key}/${name}: screenshot failed — ${String(error)}`);
  }
}

/**
 * Waits for a validation failure to render.
 *
 * Covers both shapes the app uses: `Field` marks its control `aria-invalid`, while a
 * form-level or business-rule failure renders an `Alert`, which Chakra gives `role="alert"`.
 */
async function waitForValidation(page: Page, label: string): Promise<void> {
  const marker = page.locator('[aria-invalid="true"], [role="alert"]').first();
  try {
    await marker.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    note(`${label}: no validation message appeared; capturing the form as-is`);
  }
  await sleep(300);
}

async function signIn(page: Page, email: string): Promise<void> {
  await visit(page, `${BASE_URL}/login`);
  await field(page, "email").fill(email);
  await field(page, "password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
  await settle(page);
}

async function register(page: Page, name: string, email: string): Promise<void> {
  await visit(page, `${BASE_URL}/register`);
  await field(page, "name").fill(name);
  await field(page, "email").fill(email);
  await field(page, "password").fill(PASSWORD);
  await field(page, "confirmPassword").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL(/\/(dashboard|login)/, { timeout: 45_000 });
  if (new URL(page.url()).pathname === "/login") {
    await signIn(page, email);
  }
  await settle(page);
}

// --------------------------------------------------------------------------------------
// Seeding
// --------------------------------------------------------------------------------------

/**
 * Creates the demo data through the real API.
 *
 * Driving the forms would be the more end-to-end thing to do, but that is what
 * `tests/e2e/journeys.spec.ts` is for. Here the data is scaffolding for a picture, and the
 * API is faster and cannot be thrown off by a form detail changing.
 *
 * The settlement is the exception — it is created through the UI later, because the
 * settle-up form works out the per-expense allocations itself and reproducing that
 * arithmetic here would just be a second implementation of it.
 */
async function postJson<T>(api: APIRequestContext, endpoint: string, body: unknown): Promise<T> {
  const response = await api.post(`${BASE_URL}${endpoint}`, { data: body });

  if (!response.ok()) {
    throw new Error(`POST ${endpoint} → ${response.status()} ${await response.text()}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

type Ids = {
  accounts: { bank: string; cash: string; card: string };
  categories: Record<string, string>;
  people: { arun: string; priya: string; ravi: string };
  personalExpense: string;
  sharedExpense: string;
  transfer: string;
  cardPayment: string;
};

async function seed(api: APIRequestContext): Promise<Ids> {
  type Created = { id: string };

  const account = (body: Record<string, unknown>) =>
    postJson<Created>(api, "/api/accounts", { clientId: clientId(), currency: "INR", ...body });

  const bank = await account({
    name: "HDFC Savings",
    type: "bank",
    openingBalance: "85000",
    institutionName: "HDFC Bank",
  });
  const cash = await account({ name: "Cash wallet", type: "cash", openingBalance: "4500" });
  const card = await account({
    name: "ICICI Platinum",
    type: "credit_card",
    openingBalance: "18400",
    creditLimit: "200000",
    statementDay: 18,
    paymentDueDay: 5,
    institutionName: "ICICI Bank",
  });

  /**
   * Registration already created nine top-level categories (`DEFAULT_CATEGORIES`), so those
   * are looked up rather than created — a duplicate sibling name is rejected. Only
   * sub-categories are added, which is also the more honest picture: it is what a real user
   * would have after a week of use.
   */
  const listed = await api.get(`${BASE_URL}/api/categories`);
  if (!listed.ok()) {
    throw new Error(`GET /api/categories → ${listed.status()} ${await listed.text()}`);
  }
  const { data } = (await listed.json()) as {
    data: { items: { id: string; name: string; parentId: string | null }[] };
  };

  const byName = new Map(data.items.map((item) => [item.name, item.id]));
  const parentId = (name: string): string => {
    const id = byName.get(name);
    if (!id) throw new Error(`Expected a default category called "${name}"`);
    return id;
  };

  /*
   * Each sub-category is given an icon from `CATEGORY_ICON_CHOICES`.
   *
   * Group 41's first run left them null, which is a valid state — a category with no icon falls back
   * to `ellipsis` — but it meant five of the nine swatches in the dashboard breakdown, and most of
   * the rows in the activity list, were photographed as "…". The icon picker landed in group 39, so a
   * user creating these today would choose a glyph, and the handoff should show what that looks like.
   */
  const subCategory = async (name: string, parent: string, icon: string) => {
    const created = await postJson<Created>(api, "/api/categories", {
      clientId: clientId(),
      name,
      kind: "expense",
      parentId: parent,
      icon,
    });
    return created.id;
  };

  const food = parentId("Food");
  const transport = parentId("Transport");
  const bills = parentId("Bills");

  const categories: Record<string, string> = {
    food,
    transport,
    bills,
    shopping: parentId("Shopping"),
    entertainment: parentId("Entertainment"),
    groceries: await subCategory("Groceries", food, "cart"),
    diningOut: await subCategory("Dining out", food, "cutlery"),
    fuel: await subCategory("Fuel", transport, "car"),
    cabs: await subCategory("Cabs", transport, "car"),
    electricity: await subCategory("Electricity", bills, "bolt"),
    internet: await subCategory("Internet", bills, "shield"),
  };

  const person = async (name: string, notes: string) => {
    const created = await postJson<Created>(api, "/api/people", {
      clientId: clientId(),
      name,
      notes,
    });
    return created.id;
  };

  const people = {
    arun: await person("Arun Kumar", "Flatmate"),
    priya: await person("Priya Nair", "Sister"),
    ravi: await person("Ravi Shankar", "Colleague"),
  };

  const expense = (body: Record<string, unknown>) =>
    postJson<Created>(api, "/api/expenses", {
      clientId: clientId(),
      splitClientId: clientId(),
      ...body,
    });

  // Deliberately spread across all three accounts and several categories, so the dashboard's
  // spending breakdown and the account balances both have something to show.
  const groceries = await expense({
    amount: "2480.50",
    description: "Big Basket groceries",
    date: daysAgo(1),
    accountId: bank.id,
    categoryId: categories.groceries,
  });
  await expense({
    amount: "640",
    description: "Auto to office",
    date: daysAgo(2),
    accountId: cash.id,
    categoryId: categories.cabs,
  });
  await expense({
    amount: "1299",
    description: "Netflix and Spotify",
    date: daysAgo(3),
    accountId: card.id,
    categoryId: categories.entertainment,
  });
  await expense({
    amount: "3150",
    description: "Electricity bill",
    date: daysAgo(4),
    accountId: bank.id,
    categoryId: categories.electricity,
    notes: "Two months billed together.",
  });
  await expense({
    amount: "899",
    description: "Petrol",
    date: daysAgo(5),
    accountId: card.id,
    categoryId: categories.fuel,
  });
  await expense({
    amount: "5499",
    description: "Running shoes",
    date: daysAgo(6),
    accountId: card.id,
    categoryId: categories.shopping,
  });
  await expense({
    amount: "220",
    description: "Filter coffee",
    date: daysAgo(0),
    accountId: cash.id,
    categoryId: categories.diningOut,
  });

  const shared = (body: Record<string, unknown>) =>
    postJson<Created>(api, "/api/expenses/shared", { clientId: clientId(), ...body });

  // Three-way split, paid by the user: the clearest illustration of the split editor's result.
  const teamDinner = await shared({
    amount: "4800",
    description: "Team dinner at Toit",
    date: daysAgo(3),
    accountId: bank.id,
    categoryId: categories.diningOut,
    splitMethod: "equal",
    participants: [{ personId: null }, { personId: people.arun }, { personId: people.ravi }],
  });

  await shared({
    amount: "2700",
    description: "Weekend trip cab",
    date: daysAgo(5),
    accountId: bank.id,
    categoryId: categories.cabs,
    splitMethod: "equal",
    participants: [{ personId: null }, { personId: people.arun }],
  });

  // Paid by somebody else, so no account of the user's is charged. This is what puts the
  // user on the owing side of a balance, which the dashboard needs in order to show both
  // directions.
  await shared({
    amount: "3600",
    description: "Concert tickets",
    date: daysAgo(6),
    categoryId: categories.entertainment,
    paidByPersonId: people.priya,
    splitMethod: "equal",
    participants: [{ personId: null }, { personId: people.priya }],
  });

  const transfer = await postJson<Created>(api, "/api/transfers", {
    clientId: clientId(),
    amount: "10000",
    fromAccountId: bank.id,
    toAccountId: cash.id,
    date: daysAgo(2),
    description: "Cash withdrawal",
  });

  const cardPayment = await postJson<Created>(api, "/api/credit-card-payments", {
    clientId: clientId(),
    amount: "6000",
    fromAccountId: bank.id,
    toAccountId: card.id,
    date: daysAgo(1),
    description: "Part payment",
  });

  return {
    accounts: { bank: bank.id, cash: cash.id, card: card.id },
    categories,
    people,
    personalExpense: groceries.id,
    sharedExpense: teamDinner.id,
    transfer: transfer.id,
    cardPayment: cardPayment.id,
  };
}

/**
 * Records a settlement through the settle-up form and returns its id.
 *
 * Run once, from one profile, before either profile captures the settlement pages — the
 * form is only reachable while a balance is outstanding, so submitting it from both would
 * leave the second one looking at "Nothing to settle".
 */
async function settleFully(page: Page, personId: string): Promise<string | null> {
  await visit(page, `${BASE_URL}/people/${personId}/settle`);

  const submit = page.getByRole("button", { name: "Record settlement" });
  if (!(await submit.isVisible().catch(() => false))) {
    note("settle-up: the form was not available, so no settlement was created");
    return null;
  }

  await submit.click();
  await page.waitForURL(new RegExp(`/people/${personId}$`), { timeout: 45_000 }).catch(() => {
    note("settle-up: did not return to the person page after submitting");
  });
  await settle(page);

  // The settlement has no id in the URL, so it is read back from the list.
  await visit(page, `${BASE_URL}/settlements`);
  const href = await page
    .locator('a[href^="/settlements/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);

  const id = href?.split("/").pop() ?? null;
  if (!id) note("settle-up: could not find the new settlement in the list");
  return id;
}

// --------------------------------------------------------------------------------------
// Capture passes
// --------------------------------------------------------------------------------------

async function captureAnonymous(page: Page, profile: Profile): Promise<void> {
  await visit(page, `${BASE_URL}/login`);
  await shot(page, profile, "01-login");

  await field(page, "email").fill("nobody@example.test");
  await field(page, "password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await waitForValidation(page, `${profile.key}/02-login-invalid-credentials`);
  await shot(page, profile, "02-login-invalid-credentials");

  await visit(page, `${BASE_URL}/register`);
  await shot(page, profile, "03-register");

  // One error per kind: a malformed email, a password under the minimum, and a mismatch —
  // which is the cross-field case and the one most worth designing for.
  await field(page, "email").fill("not-an-email");
  await field(page, "password").fill("short");
  await field(page, "confirmPassword").fill("different");
  await page.getByRole("button", { name: "Create account" }).click();
  await waitForValidation(page, `${profile.key}/04-register-validation-errors`);
  await shot(page, profile, "04-register-validation-errors");

  await visit(page, `${BASE_URL}/offline`);
  await shot(page, profile, "52-offline");
}

async function captureEmpty(page: Page, profile: Profile): Promise<void> {
  await visit(page, `${BASE_URL}/dashboard`);
  await shot(page, profile, "05-dashboard-empty");

  await visit(page, `${BASE_URL}/accounts`);
  await shot(page, profile, "06-accounts-empty");

  await visit(page, `${BASE_URL}/accounts/new`);
  await shot(page, profile, "07-account-new");

  // Choosing "Credit card" reveals a fieldset that exists on no other screen: credit limit,
  // statement day, payment due day. The balance field also changes meaning, from "opening
  // balance" to "current outstanding".
  await field(page, "type").selectOption("credit_card");
  await sleep(400);
  await shot(page, profile, "08-account-new-credit-card");

  // Back to a bank account so the validation shot is the ordinary form: a blank name and a
  // non-numeric balance, which are two different failure messages in one image.
  await visit(page, `${BASE_URL}/accounts/new`);
  await field(page, "openingBalance").fill("not a number");
  await page.getByRole("button", { name: "Create account" }).click();
  await waitForValidation(page, `${profile.key}/09-account-new-validation-errors`);
  await shot(page, profile, "09-account-new-validation-errors");

  await visit(page, `${BASE_URL}/people`);
  await shot(page, profile, "10-people-empty");

  await visit(page, `${BASE_URL}/people/new`);
  await shot(page, profile, "11-person-new");

  // Not an empty state: registration seeds nine top-level categories, so this screen is
  // never blank for a real user.
  await visit(page, `${BASE_URL}/categories`);
  await shot(page, profile, "12-categories-defaults");

  await visit(page, `${BASE_URL}/transactions`);
  await shot(page, profile, "13-activity-empty");

  // Each of these four renders a guard instead of a form, because the prerequisite record
  // does not exist yet. Worth designing deliberately: it is what every new user hits first.
  await visit(page, `${BASE_URL}/transactions/new`);
  await shot(page, profile, "14-expense-new-needs-account");

  await visit(page, `${BASE_URL}/transactions/new/shared`);
  await shot(page, profile, "15-split-new-needs-person");

  await visit(page, `${BASE_URL}/transactions/new/transfer`);
  await shot(page, profile, "16-transfer-new-needs-accounts");

  await visit(page, `${BASE_URL}/transactions/new/card-payment`);
  await shot(page, profile, "17-card-payment-new-needs-accounts");

  await visit(page, `${BASE_URL}/settlements`);
  await shot(page, profile, "18-settlements-empty");
}

async function capturePopulated(
  page: Page,
  profile: Profile,
  ids: Ids,
  settlementId: string | null,
): Promise<void> {
  await visit(page, `${BASE_URL}/dashboard`);
  await shot(page, profile, "19-dashboard");

  await visit(page, `${BASE_URL}/accounts`);
  await shot(page, profile, "20-accounts");

  await visit(page, `${BASE_URL}/accounts/${ids.accounts.bank}`);
  await shot(page, profile, "21-account-detail-bank");

  await visit(page, `${BASE_URL}/accounts/${ids.accounts.card}`);
  await shot(page, profile, "22-account-detail-credit-card");

  await visit(page, `${BASE_URL}/accounts/${ids.accounts.bank}/edit`);
  await shot(page, profile, "23-account-edit");

  await visit(page, `${BASE_URL}/people`);
  await shot(page, profile, "24-people");

  await visit(page, `${BASE_URL}/people/${ids.people.ravi}`);
  await shot(page, profile, "25-person-detail-owes-you");

  await visit(page, `${BASE_URL}/people/${ids.people.priya}`);
  await shot(page, profile, "26-person-detail-you-owe");

  // Arun was settled in full earlier, so this is the "square with them" state.
  await visit(page, `${BASE_URL}/people/${ids.people.arun}`);
  await shot(page, profile, "27-person-detail-settled");

  await visit(page, `${BASE_URL}/people/${ids.people.arun}/edit`);
  await shot(page, profile, "28-person-edit");

  await visit(page, `${BASE_URL}/categories`);
  await shot(page, profile, "29-categories");

  // Both category forms are inline rather than on their own page, so they only exist as an
  // interaction state.
  const addCategory = page.getByRole("button", { name: "Add category" });
  if (await addCategory.isVisible().catch(() => false)) {
    await addCategory.click();
    await sleep(400);
    await shot(page, profile, "30-categories-add-form");
  } else {
    note(`${profile.key}/30-categories-add-form: "Add category" was not visible`);
  }

  await visit(page, `${BASE_URL}/categories`);
  const editCategory = page.getByRole("button", { name: "Edit" }).first();
  if (await editCategory.isVisible().catch(() => false)) {
    await editCategory.click();
    await sleep(400);
    await shot(page, profile, "31-categories-edit-row");
  } else {
    note(`${profile.key}/31-categories-edit-row: no category "Edit" button was visible`);
  }

  await visit(page, `${BASE_URL}/transactions`);
  await shot(page, profile, "32-activity");

  await visit(
    page,
    `${BASE_URL}/transactions?type=expense&accountId=${ids.accounts.card}&shared=false`,
  );
  await shot(page, profile, "33-activity-filtered");

  await visit(page, `${BASE_URL}/transactions/new`);
  await shot(page, profile, "34-expense-new");

  // Submitted untouched: amount and description are the two required free-text fields, and
  // the account and date already carry defaults.
  await page.getByRole("button", { name: "Record expense" }).click();
  await waitForValidation(page, `${profile.key}/35-expense-new-validation-errors`);
  await shot(page, profile, "35-expense-new-validation-errors");

  await visit(page, `${BASE_URL}/transactions/${ids.personalExpense}`);
  await shot(page, profile, "36-expense-detail-personal");

  await visit(page, `${BASE_URL}/transactions/${ids.personalExpense}/edit`);
  await shot(page, profile, "37-expense-edit");

  await visit(page, `${BASE_URL}/transactions/new/shared`);
  await shot(page, profile, "38-split-new");

  // The blank form above shows almost nothing of the split editor, which is the most
  // involved control in the app. Filled in, it shows the per-person shares and the running
  // allocated total.
  await field(page, "amount").fill("4800");
  await field(page, "description").fill("Team dinner at Toit");
  for (const name of ["Arun Kumar", "Ravi Shankar"]) {
    const picker = field(page, "addParticipant");
    if (await picker.isVisible().catch(() => false)) {
      await picker.selectOption({ label: name });
      await sleep(250);
    } else {
      note(`${profile.key}/39-split-new-equal-split: could not add ${name}`);
    }
  }
  await sleep(300);
  await shot(page, profile, "39-split-new-equal-split");

  await visit(page, `${BASE_URL}/transactions/new/shared`);
  await page.getByRole("button", { name: "Record shared expense" }).click();
  await waitForValidation(page, `${profile.key}/40-split-new-validation-errors`);
  await shot(page, profile, "40-split-new-validation-errors");

  await visit(page, `${BASE_URL}/transactions/${ids.sharedExpense}`);
  await shot(page, profile, "41-expense-detail-shared");

  await visit(page, `${BASE_URL}/transactions/new/transfer`);
  await shot(page, profile, "42-transfer-new");

  await visit(page, `${BASE_URL}/transactions/${ids.transfer}`);
  await shot(page, profile, "43-transfer-detail");

  await visit(page, `${BASE_URL}/transactions/new/card-payment?cardId=${ids.accounts.card}`);
  await shot(page, profile, "44-card-payment-new");

  await visit(page, `${BASE_URL}/transactions/${ids.cardPayment}`);
  await shot(page, profile, "45-card-payment-detail");

  // Ravi is still owing, so his settle-up form is populated. Arun's was used to create the
  // settlement and is now empty.
  await visit(page, `${BASE_URL}/people/${ids.people.ravi}/settle`);
  await shot(page, profile, "46-settle-up");

  // Editing one allocation line breaks the "allocated equals payment" rule, which disables
  // the submit button and shows the warning. Changing the payment amount would not do it —
  // that re-spreads the allocations and stays balanced.
  const allocation = page.locator('input[id^="allocation-"]').first();
  if (await allocation.isVisible().catch(() => false)) {
    await allocation.fill("100");
    await allocation.blur();
    await sleep(400);
    await shot(page, profile, "47-settle-up-unbalanced");
  } else {
    note(`${profile.key}/47-settle-up-unbalanced: no allocation input was visible`);
  }

  await visit(page, `${BASE_URL}/settlements`);
  await shot(page, profile, "48-settlements");

  if (settlementId) {
    await visit(page, `${BASE_URL}/settlements/${settlementId}`);
    await shot(page, profile, "49-settlement-detail");
  } else {
    note(`${profile.key}/49-settlement-detail: skipped, no settlement was created`);
  }

  /*
   * The "Cannot edit" guard. Arun was settled in full above, and his share was on the team dinner, so
   * that expense now has a settlement allocation against it and cannot be edited.
   *
   * Asserted rather than assumed: if the seed ever changes so the shared expense is unsettled, this
   * would silently photograph a working edit form under a name that says otherwise.
   */
  await visit(page, `${BASE_URL}/transactions/${ids.sharedExpense}/edit`);
  const blocked = page.getByRole("heading", { level: 1, name: "Cannot edit" });
  if (await blocked.isVisible().catch(() => false)) {
    await shot(page, profile, "55-expense-edit-settled");
  } else {
    note(
      `${profile.key}/55-expense-edit-settled: the shared expense was editable, so the guard did not render`,
    );
  }

  // An unknown URL falls through to the root 404, which has no application chrome.
  await visit(page, `${BASE_URL}/this-page-does-not-exist`);
  await shot(page, profile, "50-not-found-page");

  // A well-formed id for a record that does not exist resolves to the `(app)` boundary
  // instead, so the header and navigation stay on screen.
  await visit(page, `${BASE_URL}/transactions/000000000000000000000000`);
  await shot(page, profile, "51-not-found-record");

  /*
   * The quick-add layer, open, over its scrim.
   *
   * Phone-only: the button is `hideFrom="md"`, so the visibility check is also the profile check.
   * Captured viewport-only — the scrim is fixed, and a full-page image of it would show one screen
   * dimmed and the rest not, which is not a state the app can be in.
   */
  await visit(page, `${BASE_URL}/dashboard`);
  const quickAdd = page.getByRole("button", { name: "Quick add" });
  if (await quickAdd.isVisible().catch(() => false)) {
    await quickAdd.click();
    await sleep(400);
    await shot(page, profile, "54-quick-add-expanded", { viewportOnly: true });
  } else if (profile.isMobile) {
    note(`${profile.key}/54-quick-add-expanded: the quick-add button was not visible`);
  }
}

// --------------------------------------------------------------------------------------
// Orchestration
// --------------------------------------------------------------------------------------

/** Matches `DISMISSED_KEY` in `src/offline/hooks/useInstallPrompt.ts`. */
const INSTALL_DISMISSED_KEY = "expense-tracker:install-dismissed";

/**
 * Two corrections applied to every page before it is photographed.
 *
 * **The install invitation is pre-dismissed.** It is a one-time banner, but it is rendered
 * by the app shell, so without this it would sit on top of all fifty mobile screenshots and
 * push six hundred pixels of real interface down the image. It gets its own screenshot
 * instead (`51-install-prompt`).
 *
 * **The bottom navigation is unpinned.** `position: fixed` and a full-page screenshot do not
 * agree: Chromium paints a fixed element where it sits in the viewport, which in a tall
 * capture is somewhere in the middle of the image, on top of whatever is behind it. Made
 * static it falls to the end of the flex column, which is where a reader expects to find it.
 * The sticky header needs no such help — the page is captured unscrolled, so it is already
 * in the right place.
 */
/** Matches `STORAGE_KEY` in `src/theme/color-mode.ts`. */
const COLOR_MODE_KEY = "expense-tracker-color-mode";

async function prepareContext(
  context: BrowserContext,
  profile: Profile,
  showInstallPrompt: boolean,
): Promise<void> {
  if (!showInstallPrompt) {
    await context.addInitScript(
      ([key]) => {
        try {
          localStorage.setItem(key!, "1");
        } catch {
          // Nothing to do: the banner will simply be visible.
        }
      },
      [INSTALL_DISMISSED_KEY],
    );
  }

  /*
   * The mode is stored, not just requested through `prefers-color-scheme`.
   *
   * The context's `colorScheme` alone would work — the app falls back to the system preference when
   * nothing is stored — but it would be testing the fallback rather than the mode. Writing the key
   * the app writes is what a user who pressed the toggle would have, and it is applied by the
   * blocking inline script before first paint, so there is no half-light frame to photograph.
   */
  await context.addInitScript(
    ([key, mode]) => {
      try {
        localStorage.setItem(key!, mode!);
      } catch {
        // The context's colorScheme still applies.
      }
    },
    [COLOR_MODE_KEY, profile.colorScheme],
  );
}

/**
 * Unpins the two fixed elements of the mobile shell, immediately before the shutter.
 *
 * Applied as inline declarations rather than an injected stylesheet: an inline `!important`
 * is the highest-priority author declaration there is, so it cannot lose to whatever class
 * Chakra generated. An injected `<style>` was tried first and did not take.
 *
 * **The bottom navigation** is made static, so it falls to the end of the flex column — which is
 * where a reader expects to find it. `position: fixed` and a full-page screenshot do not agree:
 * Chromium paints a fixed element where it sits in the *viewport*, which in a tall capture is
 * somewhere in the middle of the image, on top of whatever is behind it.
 *
 * **The quick-add button** has the same problem and needs a different answer, because it is not part
 * of any flow — it floats. Group 41's first run photographed it across the middle of every mobile
 * page, once through the date field of the expense form. It is re-anchored just above the now-static
 * nav, which is where it sits on a real phone.
 *
 * Returns false if either is still pinned, so a silent regression shows up as a reported problem
 * rather than as chrome sitting across the middle of a hundred images.
 */
async function unpinFixedChrome(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
    if (!nav) return true; // Above the breakpoint there is neither a bottom bar nor a FAB.

    nav.style.setProperty("position", "static", "important");

    // The padding existed only to clear the pinned bar, which is no longer pinned.
    document
      .querySelector<HTMLElement>("main#main")
      ?.style.setProperty("padding-bottom", "1rem", "important");

    /*
     * The quick-add layer is found by walking up from the button rather than by a selector of its
     * own, so the script needs no hook in the component. The layer is whichever ancestor is the
     * fixed one — the button itself is statically positioned inside it.
     */
    const fab = document.querySelector<HTMLElement>('button[aria-label="Quick add"]');
    let layer: HTMLElement | null = fab?.parentElement ?? null;
    while (layer && getComputedStyle(layer).position !== "fixed") {
      layer = layer.parentElement;
    }

    if (layer) {
      const height = layer.getBoundingClientRect().height;
      // Moved to `body` first: `position: absolute` resolves against the nearest positioned
      // ancestor, and the shell has several. Under `body`, which is not positioned, `top` is an
      // offset from the top of the document, which is what is wanted here.
      document.body.append(layer);
      layer.style.setProperty("position", "absolute", "important");
      layer.style.setProperty("bottom", "auto", "important");
      layer.style.setProperty("right", "20px", "important");
      layer.style.setProperty("top", `${String(nav.offsetTop - height - 16)}px`, "important");
    }

    return (
      getComputedStyle(nav).position === "static" &&
      (layer === null || getComputedStyle(layer).position === "absolute")
    );
  });
}

async function newContext(
  browser: Browser,
  profile: Profile,
  options: { showInstallPrompt?: boolean } = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    colorScheme: profile.colorScheme,
    reducedMotion: "reduce",
    // The service worker would serve cached pages part-way through the run, which is
    // exactly the kind of inconsistency a screenshot set must not have.
    serviceWorkers: "block",
  });

  await prepareContext(context, profile, options.showInstallPrompt ?? false);
  return context;
}

async function verifyOutput(): Promise<void> {
  log("\nVerifying the output…");

  for (const profile of PROFILES) {
    const dir = path.join(OUTPUT_ROOT, profile.key);
    const files = await readdir(dir).catch(() => [] as string[]);
    const present = new Set(files.filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)));
    const expected = expectedFor(profile.key);

    const missing = expected.filter((name) => !present.has(name));
    if (missing.length > 0) {
      note(`${profile.key}: missing ${String(missing.length)} — ${missing.join(", ")}`);
    }

    // A zero-length or near-empty PNG means the screenshot call succeeded but captured
    // nothing useful, which is worth catching here rather than in review.
    for (const name of present) {
      const { size } = await stat(path.join(dir, `${name}.png`));
      if (size < 3_000) {
        note(`${profile.key}/${name}.png is only ${String(size)} bytes`);
      }
    }

    log(`  ${profile.key}: ${String(present.size)}/${String(expected.length)} PNGs`);
  }
}

async function main(): Promise<number> {
  log("Starting an in-memory MongoDB replica set…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DB_NAME: DB_NAME,
    NODE_ENV: "production",
    AUTH_SECRET: "screenshot-secret-screenshot-secret-0000",
    AUTH_URL: BASE_URL,
    AUTH_TRUST_HOST: "true",
    // The run signs in several times in quick succession, which would otherwise exhaust
    // the auth budget part-way through.
    RATE_LIMIT_ENABLED: "false",
    DEFAULT_CURRENCY: "INR",
    DEFAULT_TIMEZONE: "Asia/Kolkata",
    LOG_LEVEL: "error",
  };

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    if (SKIP_BUILD) {
      log("Skipping the build (--skip-build).");
    } else {
      log("Building…");
      await run("npm", ["run", "build"], env);
    }

    log(`Serving on ${BASE_URL}…`);
    server = spawn("npx", ["next", "start", "--port", String(PORT)], {
      env,
      shell: true,
      stdio: ["ignore", "ignore", "inherit"],
    });
    await waitForServer(`${BASE_URL}/login`, 120_000);

    for (const profile of PROFILES) {
      await rm(path.join(OUTPUT_ROOT, profile.key), { recursive: true, force: true });
      await mkdir(path.join(OUTPUT_ROOT, profile.key), { recursive: true });
    }

    browser = await chromium.launch({ headless: !HEADED });

    const emptyUser = uniqueEmail("firstrun");
    const demoUser = uniqueEmail("demo");

    // --- Register both users once, and seed the demo one -------------------------------
    log("\nPreparing accounts…");
    const setupContext = await newContext(browser, PROFILES[0]!);
    const setupPage = await setupContext.newPage();

    await register(setupPage, "Anita Desai", emptyUser);
    await setupContext.clearCookies();

    await register(setupPage, "Meera Iyer", demoUser);
    log("Seeding demo data…");
    const ids = await seed(setupContext.request);

    log("Recording a settlement through the settle-up form…");
    const settlementId = await settleFully(setupPage, ids.people.arun);

    await setupContext.close();

    // --- Capture, one profile at a time ------------------------------------------------
    for (const profile of PROFILES) {
      log(`\n${profile.label}`);

      const anon = await newContext(browser, profile);
      const anonPage = await anon.newPage();
      log("  signed-out pages…");
      await captureAnonymous(anonPage, profile);
      await anon.close();

      const first = await newContext(browser, profile);
      const firstPage = await first.newPage();
      await signIn(firstPage, emptyUser);
      log("  first-run (empty) pages…");
      await captureEmpty(firstPage, profile);
      await first.close();

      const demo = await newContext(browser, profile);
      const demoPage = await demo.newPage();
      await signIn(demoPage, demoUser);
      log("  populated pages…");
      await capturePopulated(demoPage, profile, ids, settlementId);
      await demo.close();

      // A separate context, because the banner is suppressed by a stored flag everywhere
      // else and there is no way to un-dismiss it within a session.
      if (PROFILE_ONLY[profile.key]?.includes("53-install-prompt")) {
        log("  install invitation…");
        const promo = await newContext(browser, profile, { showInstallPrompt: true });
        const promoPage = await promo.newPage();
        await signIn(promoPage, demoUser);
        await visit(promoPage, `${BASE_URL}/dashboard`);
        await shot(promoPage, profile, "53-install-prompt");
        await promo.close();
      }
    }

    await verifyOutput();
  } finally {
    await browser?.close().catch(() => undefined);
    server?.kill();
    log("\nStopping MongoDB…");
    await replSet.stop();
  }

  if (problems.length > 0) {
    console.error(`\n${String(problems.length)} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }

  const total = PROFILES.reduce((sum, profile) => sum + expectedFor(profile.key).length, 0);
  log(`\nDone. ${String(total)} screenshots in ${OUTPUT_ROOT}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
