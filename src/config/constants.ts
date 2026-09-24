/**
 * Application-wide constants.
 *
 * Values with domain meaning live here instead of being inlined as magic
 * numbers (docs/06-CODING-PRACTICES.md section 54).
 */

// --- Collections ------------------------------------------------------------

export const COLLECTIONS = {
  users: "users",
  accounts: "accounts",
  people: "people",
  categories: "categories",
  transactions: "transactions",
  expenseSplits: "expenseSplits",
  settlements: "settlements",
  settlementAllocations: "settlementAllocations",
  syncOperations: "syncOperations",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// --- Currency ---------------------------------------------------------------

/**
 * Minor-unit exponent per currency. Money is rounded to this scale.
 * Multi-currency conversion is explicitly out of MVP scope, but every amount
 * still carries a currency so the domain never mixes them silently.
 */
export const CURRENCY_SCALES: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SGD: 2,
  AUD: 2,
  CAD: 2,
  JPY: 0,
};

export const DEFAULT_CURRENCY_SCALE = 2;

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SCALES);

// --- Field limits (validation) ---------------------------------------------

export const LIMITS = {
  nameMaxLength: 100,
  descriptionMaxLength: 500,
  notesMaxLength: 2_000,
  emailMaxLength: 254,
  passwordMinLength: 10,
  passwordMaxLength: 200,
  searchMaxLength: 100,

  /** Guards against resource exhaustion from oversized payloads. */
  maxParticipantsPerExpense: 50,
  maxAllocationsPerSettlement: 100,
  maxSyncOperationsPerPush: 50,

  /** Highest amount the application accepts for a single financial record. */
  maxTransactionAmount: "1000000000",

  statementDayMin: 1,
  statementDayMax: 31,
} as const;

// --- Pagination -------------------------------------------------------------

export const PAGINATION = {
  defaultLimit: 50,
  maxLimit: 100,
} as const;

// --- Rate limiting ----------------------------------------------------------

export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
  sync: { limit: 60, windowMs: 60_000 },
  read: { limit: 300, windowMs: 60_000 },
} as const;

// --- Sync -------------------------------------------------------------------

export const SYNC = {
  maxRetryCount: 8,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 5 * 60_000,
  pullPageSize: 200,
} as const;

// --- Default categories created at registration -----------------------------

/**
 * The categories a new account starts with.
 *
 * ## These are registry names now, not lucide names
 *
 * They used to be `utensils`, `shopping-bag`, `film`, `heart-pulse` and `house` — lucide names from
 * before this project had an icon set. Nothing was broken: group 25 built `STORED_NAME_ALIASES` in
 * `features/categories/icon-map.ts` precisely so existing databases full of those strings keep
 * resolving, and they do.
 *
 * Group 39 changed the constant anyway, because an alias table should be a **migration concern for old
 * data**, not the mechanism by which rows the app creates today render correctly. New accounts now
 * store the name the registry actually uses.
 *
 * **The aliases must stay.** Every account created before this change has the old strings in it.
 *
 * `src/features/categories/icon-map.test.ts` asserts every entry here is a real registry name, so the
 * next addition fails a test rather than quietly falling back to `ellipsis`.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; icon: string }> = [
  { name: "Food", icon: "cutlery" },
  { name: "Transport", icon: "car" },
  { name: "Shopping", icon: "bag" },
  { name: "Bills", icon: "receipt" },
  { name: "Entertainment", icon: "ticket" },
  // `activity` is the pulse line — the closest the registry has to a health glyph, and a good fit.
  { name: "Health", icon: "activity" },
  { name: "Travel", icon: "plane" },
  { name: "Rent", icon: "home" },
  { name: "Other", icon: "ellipsis" },
];

// --- Request/response headers ----------------------------------------------

export const REQUEST_ID_HEADER = "x-request-id";
